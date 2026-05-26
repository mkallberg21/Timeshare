import type { Case, Client, CaseStatus } from "@prisma/client";

let caseIdCounter = 1;
let clientIdCounter = 1;

export function buildClient(overrides: Partial<Client> = {}): Client {
  return {
    id: `client_${clientIdCounter++}`,
    clerkUserId: `user_test_${Date.now()}`,
    firstName: "Jane",
    lastName: "TestUser",
    email: "jane@test.example",
    phone: "+15551234567",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

export function buildCase(overrides: Partial<Case> = {}): Case {
  return {
    id: `case_${caseIdCounter++}`,
    clientId: `client_${clientIdCounter}`,
    status: "INTAKE_PENDING" as CaseStatus,
    resortName: "Test Resort",
    contractNumber: "CONTRACT-001",
    purchaseYear: 2015,
    outstandingMortgage: 25_000,
    annualMaintenanceFee: 1_500,
    pointsOrWeeks: 150_000,
    contractFilePath: null,
    qualificationScore: null,
    strategyNotes: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

export function buildFeeCalculation(
  outstandingMortgage: number,
  annualMaintenanceFee: number
): { basis: number; fee: number } {
  const basis = outstandingMortgage + annualMaintenanceFee * 5;
  return { basis, fee: basis * 0.07 };
}
