import { describe, it, expect, vi, beforeEach } from "vitest";

import { buildCase, buildClient, buildFeeCalculation } from "../../factories/case.factory";
import { CasesService } from "../../../src/cases/cases.service";

// ── Stubs ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  case: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(mockPrisma)),
};

const mockKafka = {
  emit: vi.fn().mockResolvedValue(undefined),
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("CasesService", () => {
  let service: CasesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CasesService(
      mockPrisma as unknown as Parameters<typeof CasesService>[0],
      mockKafka as unknown as Parameters<typeof CasesService>[1]
    );
  });

  describe("fee calculation", () => {
    it("returns 7% of (mortgage + annual_fee × 5)", () => {
      const { fee } = buildFeeCalculation(100_000, 3_000);
      // basis = 100000 + 3000*5 = 115000
      // fee   = 115000 * 0.07  = 8050
      expect(fee).toBe(8_050);
    });

    it("handles zero mortgage correctly", () => {
      const { fee } = buildFeeCalculation(0, 2_000);
      expect(fee).toBe(700); // 10000 * 0.07
    });
  });

  describe("create", () => {
    it("persists the case and emits a Kafka event", async () => {
      const client = buildClient();
      const expectedCase = buildCase({ clientId: client.id });

      mockPrisma.case.create.mockResolvedValue(expectedCase);

      const dto = {
        resortName: expectedCase.resortName,
        contractNumber: expectedCase.contractNumber!,
        purchaseYear: expectedCase.purchaseYear,
        outstandingMortgage: expectedCase.outstandingMortgage,
        annualMaintenanceFee: expectedCase.annualMaintenanceFee,
        pointsOrWeeks: expectedCase.pointsOrWeeks,
      };

      const result = await service.create(dto, client.clerkUserId);

      expect(mockPrisma.case.create).toHaveBeenCalledOnce();
      expect(mockKafka.emit).toHaveBeenCalledWith(
        "case.events",
        expect.objectContaining({ eventType: "case.created" })
      );
      expect(result.id).toBe(expectedCase.id);
    });
  });
});
