from __future__ import annotations

import json
from datetime import datetime, date
from dateutil.relativedelta import relativedelta
from app.assemblers.base import BaseAssembler
from app.models.evidence_pack import ApplicableLawSection
from app.legal.statutes import get_state_statutes, get_federal_statutes, get_regulatory_bodies


class ApplicableLawAssembler(BaseAssembler):
    """
    Section 5: Applicable law — statute database pre-populated, Claude applies to facts.
    """

    async def assemble(self) -> ApplicableLawSection:
        ctx = self.ctx
        state_data = get_state_statutes(ctx.resort_state)
        federal_law = get_federal_statutes()
        regulatory_bodies = get_regulatory_bodies(ctx.resort_state)

        # Calculate SOL from purchase date
        sol_expiry = None
        sol_note = None
        if ctx.purchase_date:
            try:
                purchase_dt = datetime.strptime(ctx.purchase_date[:10], "%Y-%m-%d").date()
                sol_expiry = (purchase_dt + relativedelta(years=state_data["sol_years"])).isoformat()
                days_to_expiry = (date.fromisoformat(sol_expiry) - date.today()).days
                if days_to_expiry < 0:
                    sol_note = f"WARNING: Statute of limitations expired {abs(days_to_expiry)} days ago. Analyze tolling arguments immediately."
                elif days_to_expiry < 90:
                    sol_note = f"URGENT: Statute of limitations expires in {days_to_expiry} days on {sol_expiry}."
            except (ValueError, TypeError):
                pass

        prompt = f"""Apply the following statute database to the specific facts of this timeshare case.

STATE STATUTE DATABASE ({ctx.resort_state}):
{json.dumps(state_data, indent=2)}

FEDERAL LAW:
{json.dumps(federal_law, indent=2)}

REGULATORY BODIES:
{json.dumps(regulatory_bodies, indent=2)}

CASE FACTS:
- Purchase date: {ctx.purchase_date}
- Resort: {ctx.resort_name}, {ctx.resort_state}
- Contract year: {ctx.contract_year}
- Purchase price: ${ctx.purchase_price:,.2f}
- Misrepresentation claims: {ctx.misrepresentation_claims}
- Contract analysis: {json.dumps(ctx.contract_analysis or {}, indent=2)}
- Calculated SOL expiry: {sol_expiry}
- SOL urgency note: {sol_note}

Return a JSON object matching this exact schema:
{{
  "jurisdiction": string,
  "primary_statutes": [
    {{
      "name": string,
      "citation": string,
      "relevant_provision": string,
      "how_it_applies": string,  // specific to this case's facts
      "remedies_available": [string],
      "is_violated": boolean,
      "violation_description": string | null
    }}
  ],
  "federal_law": [],  // same structure
  "regulatory_bodies": [
    {{
      "name": string,
      "complaint_url": string,
      "notes": string
    }}
  ],
  "rescission_rights": {{
    "state_rescission_days": number,
    "contract_rescission_days": number,
    "client_received_proper_notice": boolean,
    "rescission_window_was_open": boolean,
    "rescission_clause_text": string,
    "is_rescission_violation": boolean,
    "violation_description": string | null
  }},
  "statute_of_limitations_analysis": {{
    "purchase_date": string,
    "state_sol": number,
    "sol_expiry_date": string,
    "is_within_sol": boolean,
    "tollable_event_exists": boolean,
    "tollable_event_description": string | null,
    "urgency_note": string | null
  }},
  "jurisdictional_notes": string
}}

Return ONLY valid JSON. No preamble."""

        return await self._call_claude(prompt, ApplicableLawSection)  # type: ignore[return-value]

    def _system_prompt(self) -> str:
        return (
            "You are a timeshare law specialist analyzing applicable law for a specific "
            "client's case. The statute database has already been looked up — your job "
            "is to apply each statute to the specific facts of this case.\n\n"
            "Be specific about violations. Do not say \"this may violate\" — say \"this "
            "violates [Statute] § [Section] because [specific fact from this case].\"\n\n"
            "For the statute of limitations analysis:\n"
            "- Calculate the exact SOL expiry date based on purchase date\n"
            "- If the SOL has expired, flag this prominently — it may be a case killer\n"
            "- If there are tolling arguments (the resort concealed material facts, "
            "the discovery rule applies, the client only recently learned of the "
            "misrepresentation), articulate them precisely\n"
            "- A statutory violation involving concealment of rescission rights often "
            "tolls the SOL from the date of discovery, not the date of purchase —"
            "analyze whether this applies\n\n"
            "Return ONLY valid JSON matching the ApplicableLawSection schema. No preamble."
        )
