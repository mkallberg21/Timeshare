from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ─── Request / Response Models ───────────────────────────────────────────────

class GeneratePackRequest(BaseModel):
    case_id: str
    triggered_by: str
    delivery_method: str = "PORTAL"
    attorney_email: str | None = None
    personal_note: str | None = None


class GeneratePackResponse(BaseModel):
    pack_id: str
    status: str
    estimated_seconds: int = 120


class DeliverPackRequest(BaseModel):
    attorney_email: str
    delivery_method: str = "EMAIL"
    personal_note: str | None = None


# ─── Pack Record (stored in MongoDB) ─────────────────────────────────────────

class EvidencePackRecord(BaseModel):
    id: str
    case_id: str
    status: str  # GENERATING | READY | DELIVERED | FAILED
    version: int = 1
    s3_key: str | None = None
    page_count: int | None = None
    strength_score: float | None = None
    generated_at: str | None = None
    delivered_at: str | None = None
    delivered_to: str | None = None
    delivery_method: str | None = None
    error_message: str | None = None
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


# ─── Case Context (assembled from case-service) ───────────────────────────────

class CaseContext(BaseModel):
    """All data needed to generate a full evidence pack."""
    case_id: str
    pack_id: str

    # Client
    client_first_name: str
    client_last_name: str
    client_email: str
    client_address: str | None = None
    client_phone: str | None = None

    # Resort / Timeshare
    resort_name: str
    resort_developer: str
    resort_state: str
    purchase_date: str | None = None
    purchase_price: float
    maintenance_fee_annual: float
    outstanding_mortgage: float
    contract_year: int
    contract_s3_key: str | None = None

    # Attorney
    assigned_attorney_id: str | None = None
    assigned_attorney_email: str | None = None
    assigned_attorney_name: str | None = None

    # Intake / Misrepresentations
    misrepresentation_claims: list[str] = Field(default_factory=list)
    salesperson_names: list[str] = Field(default_factory=list)
    purchase_location: str | None = None
    presentation_duration_hours: float | None = None
    pressure_tactics: list[str] = Field(default_factory=list)

    # Contract analysis from document-service
    contract_analysis: dict[str, Any] | None = None

    # Resort intelligence from resort-intelligence service
    resort_intelligence: dict[str, Any] | None = None

    # Prior negotiations
    negotiations: list[dict[str, Any]] = Field(default_factory=list)

    # Documents
    documents: list[dict[str, Any]] = Field(default_factory=list)

    # Case status
    case_status: str = "UNKNOWN"
    exit_track: str | None = None
    probability_score: float | None = None


# ─── Executive Summary ────────────────────────────────────────────────────────

class KeyDeadline(BaseModel):
    description: str
    date: str | None = None
    is_missed: bool = False
    legal_significance: str


class ExecutiveSummary(BaseModel):
    client_full_name: str
    case_id: str
    pack_generated_date: str
    resort_name: str
    resort_developer: str
    purchase_date: str
    purchase_price: float
    current_maintenance_fee_annual: float
    outstanding_mortgage: float
    total_financial_exposure: float
    primary_legal_grounds: list[str]
    case_strength_rating: str  # STRONG | MODERATE | BORDERLINE
    recommended_immediate_action: str
    key_deadlines: list[KeyDeadline]
    one_page_narrative: str


# ─── Client Declaration ───────────────────────────────────────────────────────

class SwornStatement(BaseModel):
    statement_number: int
    category: str
    what_was_told_to_client: str
    what_contract_actually_says: str
    contract_page_reference: str
    applicable_statute: str
    is_verified_by_contract_text: bool


class ClientDeclaration(BaseModel):
    client_name: str
    client_address: str
    purchase_date: str
    purchase_location: str
    salesperson_names: list[str]
    presentation_duration_hours: float | None = None
    misrepresentation_statements: list[SwornStatement]
    was_informed_of_rescission_period: bool
    rescission_period_days_stated: int | None = None
    actual_rescission_period_by_law: int
    rescission_window_expired_before_awareness: bool
    was_subjected_to_pressure_tactics: bool
    pressure_tactic_descriptions: list[str]
    declaration_text: str


# ─── Contract Analysis ────────────────────────────────────────────────────────

class AnnotatedClause(BaseModel):
    clause_id: str
    clause_type: str
    verbatim_text: str
    page_number: int
    section_reference: str
    why_problematic: str
    applicable_statute: str
    caselaw: list[str]
    severity: str  # CRITICAL | MAJOR | MINOR
    is_defense_breaking_evidence: bool


class ContractAnalysisSection(BaseModel):
    document_id: str
    contract_year: int
    total_pages: int
    ocr_confidence_score: float
    critical_flags: list[AnnotatedClause]
    major_flags: list[AnnotatedClause]
    minor_flags: list[AnnotatedClause]
    illegal_terms_summary: str
    leverage_score: float
    leverage_narrative: str


# ─── Misrepresentation Matrix ─────────────────────────────────────────────────

class MisrepresentationEntry(BaseModel):
    id: int
    category: str
    client_allegation: str
    contract_contradiction: str
    contract_page_citation: str
    applicable_consumer_protection_law: str
    applicable_timeshare_statute: str
    cfpb_complaint_category: str
    settlement_leverage: str  # HIGH | MEDIUM | LOW
    prior_successful_precedent: str | None = None


class MisrepresentationMatrix(BaseModel):
    total_misrepresentations_found: int
    entries: list[MisrepresentationEntry]
    overall_misrepresentation_score: float
    prosecutorial_narrative: str


# ─── Applicable Law ───────────────────────────────────────────────────────────

class ApplicableStatute(BaseModel):
    name: str
    citation: str
    relevant_provision: str
    how_it_applies: str
    remedies_available: list[str]
    is_violated: bool
    violation_description: str | None = None


class RegulatoryBody(BaseModel):
    name: str
    complaint_url: str
    notes: str


class RescissionAnalysis(BaseModel):
    state_rescission_days: int
    contract_rescission_days: int
    client_received_proper_notice: bool
    rescission_window_was_open: bool
    rescission_clause_text: str
    is_rescission_violation: bool
    violation_description: str | None = None


class StatuteOfLimitationsAnalysis(BaseModel):
    purchase_date: str
    state_sol: int
    sol_expiry_date: str
    is_within_sol: bool
    tollable_event_exists: bool
    tollable_event_description: str | None = None
    urgency_note: str | None = None


class ApplicableLawSection(BaseModel):
    jurisdiction: str
    primary_statutes: list[ApplicableStatute]
    federal_law: list[ApplicableStatute]
    regulatory_bodies: list[RegulatoryBody]
    rescission_rights: RescissionAnalysis
    statute_of_limitations_analysis: StatuteOfLimitationsAnalysis
    jurisdictional_notes: str


# ─── Financial Impact ─────────────────────────────────────────────────────────

class DamageLineItem(BaseModel):
    description: str
    amount: float
    legal_basis: str
    is_special_damages: bool


class FinancialImpactSection(BaseModel):
    purchase_price: float
    down_payment: float | None = None
    financed_amount: float | None = None
    current_mortgage_balance: float
    interest_paid_to_date: float | None = None
    maintenance_fee_current_year: float
    maintenance_fee_historical_avg_increase: float | None = None
    maintenance_fee_projected_5_years: float
    maintenance_fee_projected_10_years: float
    total_paid_to_date: float
    total_exposure_if_no_exit: float
    estimated_damages_claim: float
    damages_breakdown: list[DamageLineItem]
    financial_hardship_narrative: str | None = None


# ─── Resort Profile ───────────────────────────────────────────────────────────

class RegulatoryAction(BaseModel):
    agency: str
    year: int
    description: str
    outcome: str
    settlement_amount: float | None = None
    source_url: str | None = None


class ResortProfileSection(BaseModel):
    resort_name: str
    developer_name: str
    developer_parent_company: str | None = None
    resort_state: str
    resistance_score: float
    receptivity_score: float
    historical_deed_back_acceptance: bool
    avg_days_to_resolution: int
    historical_success_rate: float
    known_vulnerabilities: list[str]
    prior_regulatory_actions: list[RegulatoryAction]
    cfpb_complaint_count: int | None = None
    bbb_rating: str | None = None
    bbb_complaint_count: int | None = None
    negotiation_intelligence: str
    recommended_approach: str
    contact_for_deed_back: str | None = None


# ─── Negotiation History ──────────────────────────────────────────────────────

class NegotiationRoundSummary(BaseModel):
    round_number: int
    track: str
    letter_sent_date: str | None = None
    response_date: str | None = None
    response_type: str | None = None
    summary_of_resort_response: str | None = None
    letter_s3_key: str


class NegotiationHistorySection(BaseModel):
    total_rounds: int
    current_status: str
    rounds: list[NegotiationRoundSummary]
    resort_response_pattern: str
    recommended_next_step: str


# ─── Demand Letter ────────────────────────────────────────────────────────────

class DemandLetterSection(BaseModel):
    letter_draft: str
    legal_grounds_used: list[str]
    statutes_cited: list[str]
    damages_requested: float
    response_deadline_days: int = 14
    consequences_if_ignored: list[str]
    tone_rationale: str
    instructions_for_attorney: str
    warnings_for_attorney: list[str]


# ─── CFPB Complaint ───────────────────────────────────────────────────────────

class CfpbComplaintSection(BaseModel):
    product_type: str
    issue_category: str
    sub_issue: str
    complaint_narrative: str
    desired_resolution: str
    company_cfpb_name: str
    company_address: str
    filing_instructions: str


# ─── Supporting Documents ────────────────────────────────────────────────────

class SupportingDocument(BaseModel):
    document_type: str
    description: str
    s3_key: str
    presigned_url: str
    uploaded_at: str
    relevance_to_case: str
    page_references: list[str]


class SupportingDocumentsSection(BaseModel):
    documents: list[SupportingDocument]
    missing_document_recommendations: list[str]


# ─── Full Pack Content (stored in MongoDB) ───────────────────────────────────

class EvidencePackContent(BaseModel):
    pack_id: str
    case_id: str
    generated_at: str
    section1_executive_summary: ExecutiveSummary
    section2_client_declaration: ClientDeclaration
    section3_contract_analysis: ContractAnalysisSection
    section4_misrepresentation_matrix: MisrepresentationMatrix
    section5_applicable_law: ApplicableLawSection
    section6_financial_impact: FinancialImpactSection
    section7_resort_profile: ResortProfileSection
    section8_negotiation_history: NegotiationHistorySection
    section9_demand_letter_draft: DemandLetterSection
    section10_cfpb_complaint_draft: CfpbComplaintSection | None = None
    section11_supporting_documents: SupportingDocumentsSection
    overall_strength_score: float
    strength_rationale: str
    recommended_strategy: str
    estimated_success_probability: float
    estimated_timeline_range: str
