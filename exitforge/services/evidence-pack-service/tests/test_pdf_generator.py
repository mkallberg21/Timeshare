from __future__ import annotations

"""Tests for PDF generator."""

import pytest
from unittest.mock import MagicMock, patch


def _make_minimal_content():
    """Build a minimal EvidencePackContent for PDF generation tests."""
    from app.models.evidence_pack import (
        EvidencePackContent,
        ExecutiveSummary,
        ClientDeclaration,
        ContractAnalysisSection,
        MisrepresentationMatrix,
        ApplicableLawSection,
        StatuteOfLimitationsAnalysis,
        FinancialImpactSection,
        ResortProfileSection,
        NegotiationHistorySection,
        DemandLetterSection,
        SupportingDocumentsSection,
    )

    s1 = ExecutiveSummary(
        case_strength_rating="STRONG",
        strength_score=0.85,
        one_page_narrative="Strong timeshare fraud case.",
        primary_legal_grounds=["FTPA violation", "FDUTPA"],
        recommended_immediate_action="Send demand letter",
        client_full_name="Jane Doe",
        resort_name="Test Resort",
        resort_developer="Test Developer",
        purchase_price=25000.0,
        outstanding_mortgage=18000.0,
        current_maintenance_fee_annual=1200.0,
        total_financial_exposure=63600.0,
        key_deadlines=[],
    )
    s2 = ClientDeclaration(
        client_name="Jane Doe",
        misrepresentation_statements=[],
        declaration_text="I declare under penalty of perjury that the foregoing is true.",
        actual_rescission_period_by_law=10,
        is_rescission_violation=False,
    )
    s3 = ContractAnalysisSection(
        critical_flags=[],
        major_flags=[],
        minor_flags=[],
        leverage_score=0.8,
        leverage_narrative="Strong leverage.",
        illegal_terms_summary="No illegal terms found.",
        ocr_confidence_score=0.95,
    )
    s4 = MisrepresentationMatrix(
        total_misrepresentations_found=0,
        overall_misrepresentation_score=0.0,
        prosecutorial_narrative="No entries.",
        entries=[],
    )
    sol = StatuteOfLimitationsAnalysis(
        purchase_date="2019-01-01",
        state_sol=5,
        sol_expiry_date="2024-01-01",
        is_within_sol=True,
        tollable_event_exists=False,
        urgency_note=None,
    )
    s5 = ApplicableLawSection(
        jurisdiction="FL",
        primary_statutes=[],
        federal_law=[],
        statute_of_limitations_analysis=sol,
        jurisdictional_notes="Florida is favorable.",
    )
    s6 = FinancialImpactSection(
        purchase_price=25000.0,
        current_mortgage_balance=18000.0,
        maintenance_fee_current_year=1200.0,
        maintenance_fee_projected_5_years=1530.0,
        maintenance_fee_projected_10_years=1954.0,
        total_paid_to_date=32000.0,
        total_exposure_if_no_exit=80000.0,
        estimated_damages_claim=40000.0,
        damages_breakdown=[],
    )
    s7 = ResortProfileSection(
        developer_name="Test Developer",
        resort_state="FL",
        resistance_score=0.5,
        historical_deed_back_acceptance=True,
        avg_days_to_resolution=180,
        historical_success_rate=0.72,
        known_vulnerabilities=[],
        prior_regulatory_actions=[],
        negotiation_intelligence="Responds within 30 days.",
        recommended_approach="Send formal demand first.",
    )
    s8 = NegotiationHistorySection(
        total_rounds=0,
        rounds=[],
        current_status="No prior rounds",
        resort_response_pattern="No history",
        recommended_next_step="Send initial demand letter.",
    )
    s9 = DemandLetterSection(
        letter_draft="VIA CERTIFIED MAIL\n\nDear Counsel,\nDEMAND FOR RESCISSION...",
        tone="firm",
        tone_rationale="Moderate resistance score",
        legal_grounds_used=["FDUTPA"],
        statutes_cited=["Fla. Stat. § 721.10"],
        demands=["Full rescission"],
        response_deadline_days=30,
        instructions_for_attorney="Review before sending.",
        warnings_for_attorney=[],
    )
    s11 = SupportingDocumentsSection(
        documents=[],
        missing_document_recommendations=["Upload timeshare contract"],
    )

    return EvidencePackContent(
        pack_id="ep_test001",
        case_id="CASE-001",
        generated_at="2024-01-15T12:00:00",
        section1_executive_summary=s1,
        section2_client_declaration=s2,
        section3_contract_analysis=s3,
        section4_misrepresentation_matrix=s4,
        section5_applicable_law=s5,
        section6_financial_impact=s6,
        section7_resort_profile=s7,
        section8_negotiation_history=s8,
        section9_demand_letter_draft=s9,
        section10_cfpb_complaint_draft=None,
        section11_supporting_documents=s11,
    )


def test_pdf_generator_produces_bytes():
    """generate_pdf should return bytes when WeasyPrint is available."""
    content = _make_minimal_content()

    mock_pdf = b"%PDF-1.4 mock pdf content for testing" + b"\x00" * 512
    with patch("app.pdf.generator.HTML") as mock_html:
        mock_html_instance = MagicMock()
        mock_html_instance.write_pdf.return_value = mock_pdf
        mock_html.return_value = mock_html_instance

        from app.pdf.generator import generate_pdf
        result = generate_pdf(content, attorney_name="Atty. Test")

    assert isinstance(result, bytes)
    assert len(result) > 0


def test_pdf_generator_renders_case_id():
    """HTML template should contain the case_id."""
    content = _make_minimal_content()

    captured_html = []

    with patch("app.pdf.generator.HTML") as mock_html:
        mock_html_instance = MagicMock()
        mock_html_instance.write_pdf.return_value = b"%PDF-1.4 test"
        mock_html.return_value = mock_html_instance

        def capture(filename, **kwargs):
            with open(filename, "r") as f:
                captured_html.append(f.read())
            return mock_html_instance

        mock_html.side_effect = capture

        from app.pdf.generator import generate_pdf
        generate_pdf(content)

    assert len(captured_html) == 1
    assert "CASE-001" in captured_html[0]
    assert "Jane Doe" in captured_html[0]
