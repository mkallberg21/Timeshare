from __future__ import annotations

import json
from app.assemblers.base import BaseAssembler
from app.models.evidence_pack import DemandLetterSection
from app.legal.statutes import get_state_statutes


class DemandLetterAssembler(BaseAssembler):
    """
    Section 9: Demand letter — bomb-proof, ready to put on firm letterhead.
    Tone calibrated by resort resistance score.
    """

    async def assemble(self) -> DemandLetterSection:
        ctx = self.ctx
        state_data = get_state_statutes(ctx.resort_state)
        intel = ctx.resort_intelligence or {}
        resistance_score = float(intel.get("resistance_score", 0.5))

        if resistance_score < 0.4:
            tone_instruction = (
                "TONE: Professional and cooperative — leave room for them to save face. "
                "Lead with 'opportunity to resolve' language."
            )
        elif resistance_score < 0.7:
            tone_instruction = (
                "TONE: Firm and factual — state violations clearly, demand response, "
                "no softening but no aggression."
            )
        else:
            tone_instruction = (
                "TONE: Unambiguously adversarial — make clear litigation is the next "
                "and likely step. Name the specific courthouse where the action would "
                f"be filed (use {ctx.resort_state} state court). Name the specific "
                "statutes under which attorney fees would be sought."
            )

        prompt = f"""Write a formal demand letter for this timeshare exit case.

{tone_instruction}

Case data:
{json.dumps({
    "resort_name": ctx.resort_name,
    "resort_developer": ctx.resort_developer,
    "resort_state": ctx.resort_state,
    "purchase_date": ctx.purchase_date,
    "purchase_price": ctx.purchase_price,
    "maintenance_fee_annual": ctx.maintenance_fee_annual,
    "outstanding_mortgage": ctx.outstanding_mortgage,
    "misrepresentation_claims": ctx.misrepresentation_claims,
    "primary_statute": state_data["primary_statute_citation"],
    "consumer_protection_statute": state_data["consumer_protection_citation"],
    "attorney_fees_available": state_data["attorney_fees_available"],
    "punitive_damages_available": state_data["punitive_damages_available"],
    "resistance_score": resistance_score,
    "negotiation_rounds": len(ctx.negotiations),
    "contract_analysis_flags": (ctx.contract_analysis or {}).get("misrepresentation_flags", []),
}, indent=2)}

The letter MUST include all 7 mandatory sections:
1. OPENING — identify attorney, client, timeshare, contract, state purpose
2. BACKGROUND — timeline, amounts paid, current obligation
3. MISREPRESENTATIONS — numbered list, each with specific contract citation and statute
4. LEGAL VIOLATIONS — every statute violated with exact citation
5. REMEDIES DEMANDED — rescission, mortgage release, fee cessation, response deadline, reimbursement
6. CONSEQUENCES OF NON-COMPLIANCE — CFPB, AG, civil action, attorney fees
7. DEADLINE — 14 days, professional close

Return a JSON object matching this exact schema:
{{
  "letter_draft": string,           // complete letter with proper line breaks
  "legal_grounds_used": [string],
  "statutes_cited": [string],
  "damages_requested": number,
  "response_deadline_days": 14,
  "consequences_if_ignored": [string],
  "tone_rationale": string,         // why this tone was selected
  "instructions_for_attorney": string,
  "warnings_for_attorney": [string]
}}

Return ONLY valid JSON. No preamble. The letter_draft must be complete — do not truncate."""

        return await self._call_claude(prompt, DemandLetterSection)  # type: ignore[return-value]

    def _system_prompt(self) -> str:
        return (
            "You are a senior timeshare litigation attorney writing a formal demand letter "
            "to a timeshare developer and resort on behalf of a client. This letter is "
            "designed to accomplish one of two outcomes: immediate cancellation of the "
            "timeshare contract, or a settlement that results in cancellation.\n\n"
            "The letter must be written to be read by the resort's in-house legal counsel "
            "or outside litigation attorney. Write to that audience — not to the resort's "
            "customer service department.\n\n"
            "IMPORTANT ATTORNEY INSTRUCTIONS to include in your response:\n"
            "List in the instructions_for_attorney field:\n"
            "- What must be customized before sending (attorney name, bar number, "
            "signature block, firm letterhead)\n"
            "- Any factual claims that depend solely on client testimony and have "
            "not been independently corroborated by the contract text\n"
            "- Any statute where the application is aggressive and the attorney should "
            "confirm with their own research before relying on it\n"
            "- The optimal send method (certified mail + email) and documentation advice\n\n"
            "Return ONLY valid JSON matching the DemandLetterSection schema. No preamble. "
            "The letter_draft field must contain the complete letter as formatted text "
            "with proper line breaks. Do not truncate it."
        )
