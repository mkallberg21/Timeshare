import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotFoundException, ForbiddenException, ServiceUnavailableException } from "@nestjs/common";

import { CasesService } from "../../../src/cases/cases.service";
import { CaseFactory, ClientFactory, TimeshareFactory, ResortFactory, FeeFactory, MessageFactory } from "../../factories/case.factory";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../../../src/prisma/prisma.service");
vi.mock("../../../src/kafka/kafka.service");
vi.mock("../../../src/ml/ml-client.service");

const prismaMock = {
  case: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  message: { create: vi.fn() },
  negotiation: { findMany: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prismaMock)),
};

const kafkaMock = { emit: vi.fn().mockResolvedValue(undefined) };

const mlClientMock = {
  predictTimeline: vi.fn().mockResolvedValue({
    p50Days: 90,
    p90Days: 150,
    currentStageDaysRemaining: 30,
  }),
};

const configMock = {
  getOrThrow: vi.fn((key: string) => {
    const values: Record<string, string> = {
      KAFKA_BROKERS: "localhost:9092",
      KAFKA_CLIENT_ID: "case-service",
      ML_SERVICE_URL: "http://ml-service:8001",
    };
    return values[key] ?? "";
  }),
};

function makeService(): CasesService {
  return new CasesService(
    prismaMock as never,
    kafkaMock as never,
    mlClientMock as never,
    configMock as never,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("CasesService", () => {
  let service: CasesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = makeService();
  });

  // ── createCase ─────────────────────────────────────────────────────────────

  describe("createCase", () => {
    it("calls prisma.case.create with the correct shape", async () => {
      const client = ClientFactory.build();
      const resort = ResortFactory.build();
      const expectedCase = CaseFactory.build({ clientId: client.id });
      const timeshare = TimeshareFactory.build({ caseId: expectedCase.id, resortId: resort.id });

      prismaMock.case.create.mockResolvedValue({
        ...expectedCase,
        timeshare: { ...timeshare, resort },
        client,
      });

      const dto = {
        resortId: resort.id,
        contractYear: 2018,
        purchasePrice: 25_000,
        maintenanceFeeAnnual: 1_800,
        outstandingMortgage: 8_000,
        contractS3Key: "contracts/test.pdf",
      };

      await service.createCase(client.id, dto);

      expect(prismaMock.case.create).toHaveBeenCalledOnce();
      const callArg = prismaMock.case.create.mock.calls[0][0];
      expect(callArg.data.clientId).toBe(client.id);
      expect(callArg.data.status).toBe("INTAKE");
      expect(callArg.data.timeshare.create.resortId).toBe(resort.id);
    });

    it("emits case.created Kafka event after creation", async () => {
      const client = ClientFactory.build();
      const createdCase = CaseFactory.build({ clientId: client.id });
      prismaMock.case.create.mockResolvedValue({
        ...createdCase,
        timeshare: null,
        client,
      });

      const dto = {
        resortId: "resort_123",
        contractYear: 2016,
        purchasePrice: 20_000,
        maintenanceFeeAnnual: 1_500,
        outstandingMortgage: 5_000,
        contractS3Key: "contracts/test.pdf",
      };

      await service.createCase(client.id, dto);

      expect(kafkaMock.emit).toHaveBeenCalledOnce();
      const [eventType, aggregateId, payload] = kafkaMock.emit.mock.calls[0];
      expect(eventType).toBe("case.created");
      expect(aggregateId).toBe(createdCase.id);
      expect(payload).toMatchObject({ caseId: createdCase.id, clientId: client.id });
    });

    it("returns the created case with relations", async () => {
      const client = ClientFactory.build();
      const createdCase = CaseFactory.build({ clientId: client.id });
      prismaMock.case.create.mockResolvedValue({ ...createdCase, timeshare: null, client });

      const result = await service.createCase(client.id, {
        resortId: "r1",
        contractYear: 2020,
        purchasePrice: 30_000,
        maintenanceFeeAnnual: 2_000,
        outstandingMortgage: 0,
        contractS3Key: "contracts/x.pdf",
      });

      expect(result.id).toBe(createdCase.id);
      expect(result.clientId).toBe(client.id);
    });
  });

  // ── getCaseForClient ────────────────────────────────────────────────────────

  describe("getCaseForClient", () => {
    it("throws NotFoundException when case does not exist", async () => {
      prismaMock.case.findUnique.mockResolvedValue(null);

      await expect(service.getCaseForClient("nonexistent", "user_1"))
        .rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException when clientId does not match authenticated user", async () => {
      const foundCase = CaseFactory.build({ clientId: "other_client" });
      prismaMock.case.findUnique.mockResolvedValue(foundCase);

      await expect(service.getCaseForClient(foundCase.id, "different_client"))
        .rejects.toThrow(ForbiddenException);
    });

    it("returns the case when clientId matches", async () => {
      const client = ClientFactory.build();
      const foundCase = CaseFactory.build({ clientId: client.id });
      prismaMock.case.findUnique.mockResolvedValue({ ...foundCase, timeshare: null, client });

      const result = await service.getCaseForClient(foundCase.id, client.id);

      expect(result.id).toBe(foundCase.id);
    });
  });

  // ── calculateFeeEstimate ────────────────────────────────────────────────────

  describe("calculateFeeEstimate", () => {
    it("computes basis as mortgage + (maintenance × 5) and fee as basis × 0.07", async () => {
      const timeshare = TimeshareFactory.build({
        outstandingMortgage: 100_000,
        maintenanceFeeAnnual: 3_000,
      });
      const foundCase = CaseFactory.build();
      prismaMock.case.findUniqueOrThrow.mockResolvedValue({
        ...foundCase,
        timeshare,
        fee: null,
      });

      const result = await service.calculateFeeEstimate(foundCase.id);

      // basis = 100000 + 3000*5 = 115000; fee = 115000 * 0.07 = 8050
      expect(result.basisAmount).toBe(115_000);
      expect(result.feeAmount).toBeCloseTo(8_050, 2);
      expect(result.rateDecimal).toBe(0.07);
    });

    it("handles zero outstanding mortgage correctly", async () => {
      const timeshare = TimeshareFactory.build({
        outstandingMortgage: 0,
        maintenanceFeeAnnual: 2_000,
      });
      const foundCase = CaseFactory.build();
      prismaMock.case.findUniqueOrThrow.mockResolvedValue({ ...foundCase, timeshare, fee: null });

      const result = await service.calculateFeeEstimate(foundCase.id);

      // basis = 0 + 2000*5 = 10000; fee = 10000 * 0.07 = 700
      expect(result.basisAmount).toBe(10_000);
      expect(result.feeAmount).toBeCloseTo(700, 2);
    });

    it("handles zero maintenance fee correctly", async () => {
      const timeshare = TimeshareFactory.build({
        outstandingMortgage: 50_000,
        maintenanceFeeAnnual: 0,
      });
      const foundCase = CaseFactory.build();
      prismaMock.case.findUniqueOrThrow.mockResolvedValue({ ...foundCase, timeshare, fee: null });

      const result = await service.calculateFeeEstimate(foundCase.id);

      // basis = 50000 + 0 = 50000; fee = 50000 * 0.07 = 3500
      expect(result.basisAmount).toBe(50_000);
      expect(result.feeAmount).toBeCloseTo(3_500, 2);
    });

    it("returns existing fee status and escrowId when fee exists", async () => {
      const fee = FeeFactory.build({ status: "IN_ESCROW", escrowId: "escrow_123" });
      const timeshare = TimeshareFactory.build({ outstandingMortgage: 10_000, maintenanceFeeAnnual: 1_000 });
      const foundCase = CaseFactory.build();
      prismaMock.case.findUniqueOrThrow.mockResolvedValue({ ...foundCase, timeshare, fee });

      const result = await service.calculateFeeEstimate(foundCase.id);

      expect(result.status).toBe("IN_ESCROW");
      expect(result.escrowId).toBe("escrow_123");
    });
  });

  // ── getMLTimeline ───────────────────────────────────────────────────────────

  describe("getMLTimeline", () => {
    it("calls mlClient.predictTimeline with the found case", async () => {
      const foundCase = CaseFactory.build();
      prismaMock.case.findUniqueOrThrow.mockResolvedValue({ ...foundCase, timeshare: null });

      await service.getMLTimeline(foundCase.id);

      expect(mlClientMock.predictTimeline).toHaveBeenCalledOnce();
      expect(mlClientMock.predictTimeline).toHaveBeenCalledWith(
        expect.objectContaining({ id: foundCase.id }),
      );
    });

    it("returns p50Days and p90Days from the ML client", async () => {
      const foundCase = CaseFactory.build();
      prismaMock.case.findUniqueOrThrow.mockResolvedValue({ ...foundCase, timeshare: null });

      const result = await service.getMLTimeline(foundCase.id);

      expect(result).toMatchObject({ p50Days: 90, p90Days: 150 });
    });

    it("propagates ServiceUnavailableException when mlClient throws", async () => {
      const foundCase = CaseFactory.build();
      prismaMock.case.findUniqueOrThrow.mockResolvedValue({ ...foundCase, timeshare: null });
      mlClientMock.predictTimeline.mockRejectedValue(new ServiceUnavailableException("down"));

      await expect(service.getMLTimeline(foundCase.id))
        .rejects.toThrow(ServiceUnavailableException);
    });
  });

  // ── sendMessage ─────────────────────────────────────────────────────────────

  describe("sendMessage", () => {
    it("creates message with CLIENT sender type", async () => {
      const client = ClientFactory.build();
      const foundCase = CaseFactory.build({ clientId: client.id });
      const message = MessageFactory.build({ caseId: foundCase.id, senderType: "CLIENT" });

      prismaMock.case.findUnique.mockResolvedValue(foundCase);
      prismaMock.message.create.mockResolvedValue(message);

      await service.sendMessage(foundCase.id, client.id, "Hello, how is my case?");

      const createCall = prismaMock.message.create.mock.calls[0][0];
      expect(createCall.data.senderType).toBe("CLIENT");
      expect(createCall.data.caseId).toBe(foundCase.id);
    });

    it("emits message.received Kafka event", async () => {
      const client = ClientFactory.build();
      const foundCase = CaseFactory.build({ clientId: client.id });
      const message = MessageFactory.build({ caseId: foundCase.id });

      prismaMock.case.findUnique.mockResolvedValue(foundCase);
      prismaMock.message.create.mockResolvedValue(message);

      await service.sendMessage(foundCase.id, client.id, "Update please");

      expect(kafkaMock.emit).toHaveBeenCalledOnce();
      const [eventType] = kafkaMock.emit.mock.calls[0];
      expect(eventType).toBe("message.received");
    });

    it("throws NotFoundException when case not found", async () => {
      prismaMock.case.findUnique.mockResolvedValue(null);

      await expect(service.sendMessage("bad_id", "client_1", "test"))
        .rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException when client does not own the case", async () => {
      const foundCase = CaseFactory.build({ clientId: "owner_client" });
      prismaMock.case.findUnique.mockResolvedValue(foundCase);

      await expect(service.sendMessage(foundCase.id, "different_client", "test"))
        .rejects.toThrow(ForbiddenException);
    });
  });
});
