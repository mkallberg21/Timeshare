// ─── Case Domain ─────────────────────────────────────────────────────────────

export type CaseStatus =
  | 'INTAKE'
  | 'QUALIFICATION'
  | 'DOCUMENT_REVIEW'
  | 'STRATEGY_SELECTED'
  | 'NEGOTIATION_ACTIVE'
  | 'NEGOTIATION_STALLED'
  | 'ESCALATED_LEGAL'
  | 'RESORT_RESPONDED'
  | 'SETTLEMENT_REVIEW'
  | 'EXIT_CONFIRMED'
  | 'FEE_CALCULATED'
  | 'ESCROW_RELEASED'
  | 'CLOSED_SUCCESS'
  | 'CLOSED_FAILURE';

export type ExitTrack = 'DEED_BACK' | 'LEGAL_DEMAND' | 'REGULATORY_PRESSURE' | 'LITIGATION';

export type ResponseType =
  | 'ACCEPTED'
  | 'REJECTED'
  | 'COUNTER'
  | 'LEGAL_THREAT'
  | 'NO_RESPONSE';

export type DocumentType =
  | 'TIMESHARE_CONTRACT'
  | 'DEED'
  | 'MAINTENANCE_FEE_STATEMENT'
  | 'DEMAND_LETTER'
  | 'RESORT_RESPONSE'
  | 'CFPB_COMPLAINT'
  | 'AG_COMPLAINT'
  | 'ATTORNEY_CORRESPONDENCE';

export type ProcessStatus = 'PENDING' | 'PROCESSING' | 'COMPLETE' | 'FAILED';

export type FeeStatus = 'PENDING' | 'IN_ESCROW' | 'RELEASED' | 'REFUNDED';

export type SenderType = 'CLIENT' | 'AI_AGENT' | 'CASE_MANAGER' | 'ATTORNEY';

// ─── Core Entities ───────────────────────────────────────────────────────────

export interface Case {
  id: string;
  clientId: string;
  status: CaseStatus;
  exitTrack: ExitTrack | null;
  /** 0–1 probability of successful exit from ML model */
  probabilityScore: number | null;
  /** ML-predicted median days to close */
  timelineP50Days: number | null;
  /** ML-predicted 90th-percentile days to close */
  timelineP90Days: number | null;
  assignedAttorneyId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Client {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  preferredLanguage: string;
  referralSource: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Timeshare {
  id: string;
  caseId: string;
  resortId: string;
  contractYear: number;
  purchasePrice: number;
  maintenanceFeeAnnual: number;
  outstandingMortgage: number;
  /** S3 object key — never a public URL */
  contractS3Key: string;
}

export interface Resort {
  id: string;
  name: string;
  developerId: string;
  state: string;
  country: string;
  deedBackAvailable: boolean;
  /** 0–1: how hard they fight exits */
  resistanceScore: number;
  /** 0–1: how open to deed-backs */
  receptivityScore: number;
  lastUpdated: Date;
}

export interface Negotiation {
  id: string;
  caseId: string;
  track: ExitTrack;
  roundNumber: number;
  /** S3 key for the demand letter PDF */
  letterS3Key: string | null;
  sentAt: Date | null;
  responseReceivedAt: Date | null;
  responseType: ResponseType | null;
  nextAction: string | null;
  nextActionDueAt: Date | null;
  createdAt: Date;
}

export interface Document {
  id: string;
  caseId: string;
  type: DocumentType;
  /** S3 object key */
  s3Key: string;
  ocrStatus: ProcessStatus;
  analysisStatus: ProcessStatus;
  uploadedAt: Date;
}

export interface CaseEvent {
  id: string;
  caseId: string;
  eventType: string;
  triggeredBy: string;
  metadataJson: Record<string, unknown>;
  createdAt: Date;
}

export interface Fee {
  id: string;
  caseId: string;
  /** Total value recovered or obligation eliminated */
  basisAmount: number;
  /** Always 0.07 (7%) */
  rateDecimal: number;
  /** basisAmount * rateDecimal */
  feeAmount: number;
  status: FeeStatus;
  escrowId: string | null;
  calculatedAt: Date;
  releasedAt: Date | null;
}

export interface Attorney {
  id: string;
  name: string;
  barNumber: string;
  statesLicensed: string[];
  specialization: string;
  firmName: string;
  contactEmail: string;
  active: boolean;
}

export interface Message {
  id: string;
  caseId: string;
  senderType: SenderType;
  content: string;
  isRead: boolean;
  createdAt: Date;
}

// ─── ML / AI Scoring ─────────────────────────────────────────────────────────

export interface QualificationScore {
  /** 0–1 exit probability */
  score: number;
  /** true when score >= 0.65 */
  eligible: boolean;
  estimatedRecoveryLow: number;
  estimatedRecoveryHigh: number;
  recommendedTrack: ExitTrack;
  reason: string;
}

export interface ContractIntelligenceReport {
  documentId: string;
  extractedText: string;
  clauses: ContractClause[];
  misrepresentationFlags: MisrepresentationFlag[];
  illegalTermFlags: IllegalTermFlag[];
  rescissionWindowDays: number | null;
  hasPerpetuityLanguage: boolean;
  /** 0–1 OCR + extraction confidence */
  confidence: number;
}

export interface ContractClause {
  id: string;
  type: string;
  text: string;
  pageNumber: number;
  isProblematic: boolean;
  legalBasis: string | null;
}

export interface MisrepresentationFlag {
  id: string;
  description: string;
  clauseId: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  legalBasis: string;
}

export interface IllegalTermFlag {
  id: string;
  description: string;
  clauseId: string;
  statute: string;
  jurisdiction: string;
}

export interface NegotiationRound {
  id: string;
  caseId: string;
  track: ExitTrack;
  roundNumber: number;
  /** S3 key for the letter */
  letterS3Key: string;
  sentAt: Date | null;
  responseReceivedAt: Date | null;
  responseType: ResponseType | null;
  nextAction: string | null;
  nextActionDueAt: Date | null;
}

export interface FeeCalculation {
  caseId: string;
  basisAmount: number;
  rateDecimal: number;
  feeAmount: number;
  status: FeeStatus;
  escrowId: string | null;
}

export interface ResortIntelligence {
  resortId: string;
  resortName: string;
  resistanceScore: number;
  receptivityScore: number;
  preferredExitTrack: ExitTrack;
  avgDaysToClose: number | null;
  successRateByTrack: Partial<Record<ExitTrack, number>>;
  lastEnrichedAt: Date;
}

// ─── Kafka Event Envelope ────────────────────────────────────────────────────

export interface KafkaEvent<T = unknown> {
  /** UUID v4 */
  eventId: string;
  eventType: KafkaEventType;
  /** caseId */
  aggregateId: string;
  /** ISO 8601 */
  timestamp: string;
  /** Schema version — increment on breaking changes */
  version: number;
  payload: T;
  metadata: {
    correlationId: string;
    causationId: string;
    service: string;
  };
}

export type KafkaEventType =
  | 'case.created'
  | 'case.status.changed'
  | 'case.qualification.completed'
  | 'case.contract.analysis.completed'
  | 'case.strategy.selected'
  | 'case.negotiation.letter.generated'
  | 'case.negotiation.letter.sent'
  | 'case.negotiation.response.received'
  | 'case.human.review.required'
  | 'case.exit.confirmed'
  | 'case.fee.calculated'
  | 'case.escrow.released'
  | 'case.closed'
  | 'message.received'
  | 'message.ai.response.sent'
  | 'document.uploaded'
  | 'document.ocr.completed'
  | 'document.analysis.completed'
  | 'evidence_pack.generation_started'
  | 'evidence_pack.ready'
  | 'evidence_pack.delivered'
  | 'evidence_pack.failed';

// ─── Kafka Event Payloads ────────────────────────────────────────────────────

export interface CaseCreatedPayload {
  caseId: string;
  clientId: string;
}

export interface CaseStatusChangedPayload {
  caseId: string;
  previousStatus: CaseStatus;
  newStatus: CaseStatus;
  triggeredBy: string;
}

export interface QualificationCompletedPayload {
  caseId: string;
  score: number;
  eligible: boolean;
  recommendedTrack: ExitTrack;
}

export interface ContractAnalysisCompletedPayload {
  caseId: string;
  documentId: string;
  confidence: number;
  misrepresentationCount: number;
  illegalTermCount: number;
}

export interface StrategySelectedPayload {
  caseId: string;
  primaryTrack: ExitTrack;
  fallbackTrack: ExitTrack | null;
  rationale: string;
}

export interface NegotiationLetterGeneratedPayload {
  caseId: string;
  roundNumber: number;
  track: ExitTrack;
  letterS3Key: string;
}

export interface NegotiationResponseReceivedPayload {
  caseId: string;
  negotiationId: string;
  responseType: ResponseType;
  receivedAt: string;
}

export interface HumanReviewRequiredPayload {
  caseId: string;
  reason: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  context: Record<string, unknown>;
}

export interface FeeCalculatedPayload {
  caseId: string;
  basisAmount: number;
  feeAmount: number;
  feeRate: number;
}

export interface DocumentUploadedPayload {
  caseId: string;
  documentId: string;
  type: DocumentType;
  s3Key: string;
}

// ─── API Response Wrapper ────────────────────────────────────────────────────

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ─── DTOs (shared between services and API client) ───────────────────────────

export interface CreateCaseInput {
  resortId: string;
  contractYear: number;
  purchasePrice: number;
  maintenanceFeeAnnual: number;
  outstandingMortgage: number;
  contractS3Key: string;
}

export interface UpdateCaseStatusInput {
  status: CaseStatus;
  triggeredBy: string;
  reason?: string;
}

export interface SendMessageInput {
  content: string;
}

export interface PresignedUploadResponse {
  uploadUrl: string;
  s3Key: string;
  expiresAt: string;
}

// ─── Attorney Evidence Pack ───────────────────────────────────────────────────

export type EvidencePackStatus = 'GENERATING' | 'READY' | 'DELIVERED' | 'FAILED';

export type EvidencePackDeliveryMethod = 'EMAIL' | 'PORTAL' | 'SECURE_LINK';

export interface EvidencePack {
  id: string;
  caseId: string;
  status: EvidencePackStatus;
  version: number;
  s3Key: string | null;
  pageCount: number | null;
  generatedAt: Date | null;
  deliveredAt: Date | null;
  deliveredTo: string | null;
  deliveryMethod: EvidencePackDeliveryMethod | null;
  strengthScore: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EvidencePackContent {
  packId: string;
  caseId: string;
  generatedAt: string;
  section1_executiveSummary: ExecutiveSummary;
  section2_clientDeclaration: ClientDeclaration;
  section3_contractAnalysis: ContractAnalysisSection;
  section4_misrepresentationMatrix: MisrepresentationMatrix;
  section5_applicableLaw: ApplicableLawSection;
  section6_financialImpact: FinancialImpactSection;
  section7_resortProfile: ResortProfileSection;
  section8_negotiationHistory: NegotiationHistorySection;
  section9_demandLetterDraft: DemandLetterSection;
  section10_cfpbComplaintDraft: CfpbComplaintSection | null;
  section11_supportingDocuments: SupportingDocumentsSection;
  overallStrengthScore: number;
  strengthRationale: string;
  recommendedStrategy: string;
  estimatedSuccessProbability: number;
  estimatedTimelineRange: string;
}

export interface ExecutiveSummary {
  clientFullName: string;
  caseId: string;
  packGeneratedDate: string;
  resortName: string;
  resortDeveloper: string;
  purchaseDate: string;
  purchasePrice: number;
  currentMaintenanceFeeAnnual: number;
  outstandingMortgage: number;
  totalFinancialExposure: number;
  primaryLegalGrounds: string[];
  caseStrengthRating: 'STRONG' | 'MODERATE' | 'BORDERLINE';
  recommendedImmediateAction: string;
  keyDeadlines: KeyDeadline[];
  onePageNarrative: string;
}

export interface KeyDeadline {
  description: string;
  date: string | null;
  isMissed: boolean;
  legalSignificance: string;
}

export interface ClientDeclaration {
  clientName: string;
  clientAddress: string;
  purchaseDate: string;
  purchaseLocation: string;
  salespersonNames: string[];
  presentationDurationHours: number | null;
  misrepresentationStatements: SwornStatement[];
  wasInformedOfRescissionPeriod: boolean;
  rescissionPeriodDaysStated: number | null;
  actualRescissionPeriodByLaw: number;
  rescissionWindowExpiredBeforeAwareness: boolean;
  wasSubjectedToPressureTactics: boolean;
  pressureTacticDescriptions: string[];
  declarationText: string;
}

export interface SwornStatement {
  statementNumber: number;
  category:
    | 'RENTAL_INCOME'
    | 'INVESTMENT_VALUE'
    | 'EXCHANGE_PROGRAM'
    | 'MAINTENANCE_FEE_CAP'
    | 'PERPETUITY_CONCEALMENT'
    | 'RESCISSION_CONCEALMENT'
    | 'PRESSURE_TACTICS'
    | 'OTHER';
  whatWasToldToClient: string;
  whatContractActuallySays: string;
  contractPageReference: string;
  applicableStatute: string;
  isVerifiedByContractText: boolean;
}

export interface ContractAnalysisSection {
  documentId: string;
  contractYear: number;
  totalPages: number;
  ocrConfidenceScore: number;
  criticalFlags: AnnotatedClause[];
  majorFlags: AnnotatedClause[];
  minorFlags: AnnotatedClause[];
  illegalTermsSummary: string;
  leverageScore: number;
  leverageNarrative: string;
}

export interface AnnotatedClause {
  clauseId: string;
  clauseType: string;
  verbatimText: string;
  pageNumber: number;
  sectionReference: string;
  whyProblematic: string;
  applicableStatute: string;
  caselaw: string[];
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
  isDefenseBreakingEvidence: boolean;
}

export interface MisrepresentationMatrix {
  totalMisrepresentationsFound: number;
  entries: MisrepresentationEntry[];
  overallMisrepresentationScore: number;
  prosecutorialNarrative: string;
}

export interface MisrepresentationEntry {
  id: number;
  category: string;
  clientAllegation: string;
  contractContradiction: string;
  contractPageCitation: string;
  applicableConsumerProtectionLaw: string;
  applicableTimeshareStatute: string;
  cfpbComplaintCategory: string;
  settlementLeverage: 'HIGH' | 'MEDIUM' | 'LOW';
  priorSuccessfulPrecedent: string | null;
}

export interface ApplicableLawSection {
  jurisdiction: string;
  primaryStatutes: ApplicableStatute[];
  federalLaw: ApplicableStatute[];
  regulatoryBodies: RegulatoryBody[];
  rescissionRights: RescissionAnalysis;
  statuteOfLimitationsAnalysis: StatuteOfLimitationsAnalysis;
  jurisdictionalNotes: string;
}

export interface ApplicableStatute {
  name: string;
  citation: string;
  relevantProvision: string;
  howItApplies: string;
  remediesAvailable: string[];
  isViolated: boolean;
  violationDescription: string | null;
}

export interface RegulatoryBody {
  name: string;
  complaintUrl: string;
  notes: string;
}

export interface RescissionAnalysis {
  stateRescissionDays: number;
  contractRescissionDays: number;
  clientReceivedProperNotice: boolean;
  rescissionWindowWasOpen: boolean;
  rescissionClauseText: string;
  isRescissionViolation: boolean;
  violationDescription: string | null;
}

export interface StatuteOfLimitationsAnalysis {
  purchaseDate: string;
  stateSOL: number;
  soLExpiryDate: string;
  isWithinSOL: boolean;
  tollableEventExists: boolean;
  tollableEventDescription: string | null;
  urgencyNote: string | null;
}

export interface FinancialImpactSection {
  purchasePrice: number;
  downPayment: number | null;
  financedAmount: number | null;
  currentMortgageBalance: number;
  interestPaidToDate: number | null;
  maintenanceFeeCurrentYear: number;
  maintenanceFeeHistoricalAvgIncrease: number | null;
  maintenanceFeeProjected5Years: number;
  maintenanceFeeProjected10Years: number;
  totalPaidToDate: number;
  totalExposureIfNoExit: number;
  estimatedDamagesClaim: number;
  damagesBreakdown: DamageLineItem[];
  financialHardshipNarrative: string | null;
}

export interface DamageLineItem {
  description: string;
  amount: number;
  legalBasis: string;
  isSpecialDamages: boolean;
}

export interface ResortProfileSection {
  resortName: string;
  developerName: string;
  developerParentCompany: string | null;
  resortState: string;
  resistanceScore: number;
  receptivityScore: number;
  historicalDeedBackAcceptance: boolean;
  avgDaysToResolution: number;
  historicalSuccessRate: number;
  knownVulnerabilities: string[];
  priorRegulatoryActions: RegulatoryAction[];
  cfpbComplaintCount: number | null;
  bbbRating: string | null;
  bbbComplaintCount: number | null;
  negotiationIntelligence: string;
  recommendedApproach: string;
  contactForDeedBack: string | null;
}

export interface RegulatoryAction {
  agency: string;
  year: number;
  description: string;
  outcome: string;
  settlementAmount: number | null;
  sourceUrl: string | null;
}

export interface NegotiationHistorySection {
  totalRounds: number;
  currentStatus: string;
  rounds: NegotiationRoundSummary[];
  resortResponsePattern: string;
  recommendedNextStep: string;
}

export interface NegotiationRoundSummary {
  roundNumber: number;
  track: string;
  letterSentDate: string | null;
  responseDate: string | null;
  responseType: string | null;
  summaryOfResortResponse: string | null;
  letterS3Key: string;
}

export interface DemandLetterSection {
  letterDraft: string;
  legalGroundsUsed: string[];
  statutesCited: string[];
  damagesRequested: number;
  responseDeadlineDays: number;
  consequencesIfIgnored: string[];
  toneRationale: string;
  instructionsForAttorney: string;
  warningsForAttorney: string[];
}

export interface CfpbComplaintSection {
  productType: string;
  issueCategory: string;
  subIssue: string;
  complaintNarrative: string;
  desiredResolution: string;
  companyCfpbName: string;
  companyAddress: string;
  filingInstructions: string;
}

export interface SupportingDocumentsSection {
  documents: SupportingDocument[];
  missingDocumentRecommendations: string[];
}

export interface SupportingDocument {
  documentType: string;
  description: string;
  s3Key: string;
  presignedUrl: string;
  uploadedAt: string;
  relevanceToCase: string;
  pageReferences: string[];
}

// ─── Evidence Pack Kafka Payloads ─────────────────────────────────────────────

export interface EvidencePackGenerationStartedPayload {
  packId: string;
  caseId: string;
  version: number;
  triggeredBy: string;
}

export interface EvidencePackReadyPayload {
  packId: string;
  caseId: string;
  version: number;
  s3Key: string;
  pageCount: number;
  strengthScore: number;
}

export interface EvidencePackDeliveredPayload {
  packId: string;
  caseId: string;
  deliveredTo: string;
  deliveryMethod: EvidencePackDeliveryMethod;
  deliveredAt: string;
}

export interface EvidencePackFailedPayload {
  packId: string;
  caseId: string;
  errorMessage: string;
}
