import { faker } from "@faker-js/faker";
import type { Case, Client, Timeshare, Resort, Fee, Message } from "@prisma/client";

// ─── Client Factory ───────────────────────────────────────────────────────────

export const ClientFactory = {
  build: (overrides: Partial<Client> = {}): Client => ({
    id: faker.string.nanoid(),
    email: faker.internet.email(),
    phone: faker.phone.number(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    preferredLanguage: "en",
    referralSource: null,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  }),
};

// ─── Resort Factory ───────────────────────────────────────────────────────────

export const ResortFactory = {
  build: (overrides: Partial<Resort> = {}): Resort => ({
    id: faker.string.nanoid(),
    name: faker.company.name() + " Vacation Club",
    developerId: faker.string.uuid(),
    state: faker.location.state({ abbreviated: true }),
    country: "US",
    deedBackAvailable: faker.datatype.boolean(),
    resistanceScore: faker.number.float({ min: 0.1, max: 0.9, fractionDigits: 2 }),
    receptivityScore: faker.number.float({ min: 0.1, max: 0.9, fractionDigits: 2 }),
    lastUpdated: faker.date.recent(),
    ...overrides,
  }),
};

// ─── Timeshare Factory ────────────────────────────────────────────────────────

export const TimeshareFactory = {
  build: (overrides: Partial<Timeshare> = {}): Timeshare => ({
    id: faker.string.nanoid(),
    caseId: faker.string.nanoid(),
    resortId: faker.string.nanoid(),
    contractYear: faker.number.int({ min: 1990, max: 2020 }),
    purchasePrice: faker.number.float({ min: 5000, max: 100000, fractionDigits: 2 }),
    maintenanceFeeAnnual: faker.number.float({ min: 500, max: 5000, fractionDigits: 2 }),
    outstandingMortgage: faker.number.float({ min: 0, max: 50000, fractionDigits: 2 }),
    contractS3Key: `contracts/${faker.string.uuid()}.pdf`,
    ...overrides,
  }),
};

// ─── Case Factory ─────────────────────────────────────────────────────────────

export const CaseFactory = {
  build: (overrides: Partial<Case> = {}): Case => ({
    id: faker.string.nanoid(),
    clientId: faker.string.nanoid(),
    status: "INTAKE",
    exitTrack: null,
    probabilityScore: null,
    timelineP50Days: null,
    timelineP90Days: null,
    assignedAttorneyId: null,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  }),

  buildWithTimeshare: (
    overrides: Partial<Case> = {},
    timeshareOverrides: Partial<Timeshare> = {},
  ): Case & { timeshare: Timeshare & { resort: Resort }; fee: Fee | null } => {
    const resort = ResortFactory.build();
    const base = CaseFactory.build(overrides);
    const timeshare = TimeshareFactory.build({ caseId: base.id, resortId: resort.id, ...timeshareOverrides });
    return {
      ...base,
      timeshare: { ...timeshare, resort },
      fee: null,
    };
  },
};

// ─── Message Factory ──────────────────────────────────────────────────────────

export const MessageFactory = {
  build: (overrides: Partial<Message> = {}): Message => ({
    id: faker.string.nanoid(),
    caseId: faker.string.nanoid(),
    senderType: "CLIENT",
    content: faker.lorem.sentence(),
    createdAt: faker.date.recent(),
    ...overrides,
  }),
};

// ─── Fee Factory ──────────────────────────────────────────────────────────────

export const FeeFactory = {
  build: (overrides: Partial<Fee> = {}): Fee => ({
    id: faker.string.nanoid(),
    caseId: faker.string.nanoid(),
    basisAmount: faker.number.float({ min: 10000, max: 200000, fractionDigits: 2 }),
    rateDecimal: 0.07,
    feeAmount: faker.number.float({ min: 700, max: 14000, fractionDigits: 2 }),
    status: "PENDING",
    escrowId: null,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  }),
};
