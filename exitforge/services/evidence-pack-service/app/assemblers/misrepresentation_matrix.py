from __future__ import annotations

import json
from app.assemblers.base import BaseAssembler
from app.models.evidence_pack import MisrepresentationMatrix
from app.legal.statutes import get_state_statutes
from app.legal.precedents import get_precedents_for_resort


class MisrepresentationMatrixAssembler(BaseAssembler):
    """
    Section 4: Misrepresentation matrix — the single most powerful section.
    Every claim mapped to its contractual contradiction and applicable law.
    """

    async def assemble(self) -> MisrepresentationMatrix:
        ctx = self.ctx
        state_data = get_state_statutes(ctx.resort_state)
        precedents = get_precedents_for_resort(ctx.resort_name)

        prompt = f"""Build a complete misrepresentation matrix for this timeshare case.

Client misrepresentation claims:
{json.dumps(ctx.misrepresentation_claims, indent=2)}

Contract analysis (use for contractual contradictions):
{json.dumps(ctx.contract_analysis or {}, indent=2)}

Jurisdiction: {ctx.resort_state}
Primary timeshare statute: {state_data["primary_statute_citation"]}
Consumer protection statute: {state_data["consumer_protection_citation"]}
Known precedents for this resort: {json.dumps(precedents, indent=2)}

Return a JSON object matching this exact schema:
{{
  "total_misrepresentations_found": number,
  "entries": [
    {{
      "id": number,
      "category": string,
      "client_allegation": string,          // precise, legally neutral language
      "contract_contradiction": string,      // verbatim contract language if available
      "contract_page_citation": string,      // "Page X, Section Y.Z"
      "applicable_consumer_protection_law": string,  // full statute name + section
      "applicable_timeshare_statute": string,         // full statute name + section
      "cfpb_complaint_category": string,
      "settlement_leverage": "HIGH" | "MEDIUM" | "LOW",
      "prior_successful_precedent": string | null  // cite only if certain; null if not
    }}
  ],
  "overall_misrepresentation_score": number,  // 0-1
  "prosecutorial_narrative": string  // opening argument paragraph for demand letter
}}

Return ONLY valid JSON. No preamble."""

        return await self._call_claude(prompt, MisrepresentationMatrix)  # type: ignore[return-value]

    def _system_prompt(self) -> str:
        return (
            "You are conducting a legal audit of a timeshare sales transaction. Your job "
            "is to build a misrepresentation matrix that will be used in a formal legal "
            "demand letter and potentially in litigation.\n\n"
            "For each misrepresentation identified, you must:\n"
            "1. State the client's allegation in precise, legally neutral language\n"
            "2. Quote the actual contract language verbatim (from the OCR text provided) "
            "with exact page and section citation\n"
            "3. Identify the specific consumer protection statute violated — use the "
            "actual statute name and section number for the state in question\n"
            "4. Identify the specific timeshare statute violated (if applicable)\n"
            "5. Identify how this would be categorized in a CFPB complaint\n"
            "6. Rate the settlement leverage:\n"
            "   HIGH = this alone is often sufficient for a successful exit\n"
            "   MEDIUM = strong supporting evidence when combined with others\n"
            "   LOW = useful but unlikely to be dispositive alone\n"
            "7. If you know of a successful precedent case involving this resort or "
            "this type of misrepresentation, cite it. If you do not know of one "
            "with certainty, leave the field null — do not fabricate case citations.\n\n"
            "The prosecutorial narrative must be written as the opening argument in a "
            "demand letter — factual, specific, and designed to make the resort's legal "
            "team immediately calculate settlement as cheaper than defense.\n\n"
            "Return ONLY valid JSON matching the MisrepresentationMatrix schema. No preamble."
        )
