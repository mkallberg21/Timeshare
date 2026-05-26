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
  | 'document.analysis.completed';

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
