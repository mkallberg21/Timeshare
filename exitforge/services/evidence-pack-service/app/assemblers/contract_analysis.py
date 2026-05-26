from __future__ import annotations

import json
from app.assemblers.base import BaseAssembler
from app.models.evidence_pack import ContractAnalysisSection


class ContractAnalysisAssembler(BaseAssembler):
    """Section 3: Contract analysis — clauses organized by severity."""

    async def assemble(self) -> ContractAnalysisSection:
        ctx = self.ctx
        analysis = ctx.contract_analysis or {}

        prompt = f"""Analyze this contract intelligence report and produce a structured legal audit.

Contract analysis data from document-service:
{json.dumps(analysis, indent=2)}

Case context:
- Resort: {ctx.resort_name}, {ctx.resort_state}
- Contract year: {ctx.contract_year}
- Purchase price: ${ctx.purchase_price:,.2f}
- Misrepresentation claims: {ctx.misrepresentation_claims}

Return a JSON object matching this exact schema:
{{
  "document_id": string,
  "contract_year": number,
  "total_pages": number,
  "ocr_confidence_score": number,  // 0-1
  "critical_flags": [  // Void/illegal provisions
    {{
      "clause_id": string,
      "clause_type": string,
      "verbatim_text": string,
      "page_number": number,
      "section_reference": string,
      "why_problematic": string,
      "applicable_statute": string,
      "caselaw": [string],
      "severity": "CRITICAL",
      "is_defense_breaking_evidence": boolean
    }}
  ],
  "major_flags": [],  // same structure, severity = "MAJOR"
  "minor_flags": [],  // same structure, severity = "MINOR"
  "illegal_terms_summary": string,
  "leverage_score": number,  // 0-1
  "leverage_narrative": string  // attorney-facing explanation
}}

Return ONLY valid JSON. No preamble."""

        return await self._call_claude(prompt, ContractAnalysisSection)  # type: ignore[return-value]

    def _system_prompt(self) -> str:
        return (
            "You are a senior timeshare contract attorney conducting a legal audit of "
            "a timeshare purchase agreement. Your job is to identify every provision "
            "that is void, illegal, or provides evidence of misrepresentation.\n\n"
            "Severity definitions:\n"
            "- CRITICAL: Provision that may void the contract or constitutes clear "
            "statutory violation. These are your strongest arguments.\n"
            "- MAJOR: Strong evidence of misrepresentation or consumer protection "
            "violation. Highly persuasive but not alone sufficient.\n"
            "- MINOR: Supporting evidence. Adds credibility to the overall case.\n\n"
            "For caselaw: Only cite cases you are highly confident exist. If you are "
            "not certain, leave the array empty. Do not fabricate citations.\n\n"
            "The leverage_narrative should explain to an attorney how to use this "
            "contract analysis in a demand letter or litigation.\n\n"
            "Return ONLY valid JSON matching the ContractAnalysisSection schema. No preamble."
        )
