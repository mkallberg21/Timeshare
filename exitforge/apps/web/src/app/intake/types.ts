export interface ResortBasicsData {
  resortId: string;
  resortName: string;
  contractYear: number;
  purchasePrice: number;
  maintenanceFeeAnnual: number;
  outstandingMortgage: number;
  contractS3Key: string;
}

export interface MisrepresentationData {
  misrepresentationCount: number;
  hasFinancialHardship: boolean;
  hasPerpetualContract: boolean;
  issues: string[];
}

export interface QualificationResult {
  score: number;
  eligible: boolean;
  estimatedRecoveryLow: number;
  estimatedRecoveryHigh: number;
  recommendedTrack: string;
  explanation: string;
}

export interface IntakeFormData {
  resortId: string;
  contractYear: number;
  purchasePrice: number;
  maintenanceFeeAnnual: number;
  outstandingMortgage: number;
  contractS3Key: string;
}
