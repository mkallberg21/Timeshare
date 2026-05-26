from __future__ import annotations

import json
from app.assemblers.base import BaseAssembler
from app.models.evidence_pack import ClientDeclaration
from app.legal.statutes import get_state_statutes


class ClientDeclarationAssembler(BaseAssembler):
    """Section 2: Sworn declaration — every claim numbered and cross-referenced."""

    async def assemble(self) -> ClientDeclaration:
        ctx = self.ctx
        state_data = get_state_statutes(ctx.resort_state)

        prompt = f"""Draft a sworn declaration for the following timeshare case.

Client information:
{json.dumps({
    "client_name": f"{ctx.client_first_name} {ctx.client_last_name}",
    "client_address": ctx.client_address or "Address on file",
    "purchase_date": ctx.purchase_date,
    "purchase_location": ctx.purchase_location or "Sales presentation location",
    "salesperson_names": ctx.salesperson_names,
    "presentation_duration_hours": ctx.presentation_duration_hours,
    "misrepresentation_claims": ctx.misrepresentation_claims,
    "pressure_tactics": ctx.pressure_tactics,
    "resort_state": ctx.resort_state,
    "rescission_days_by_law": state_data["rescission_days"],
}, indent=2)}

Contract analysis (for cross-referencing claims):
{json.dumps(ctx.contract_analysis or {}, indent=2)}

Return a JSON object matching this exact schema:
{{
  "client_name": string,
  "client_address": string,
  "purchase_date": string,
  "purchase_location": string,
  "salesperson_names": [string],
  "presentation_duration_hours": number | null,
  "misrepresentation_statements": [
    {{
      "statement_number": number,
      "category": "RENTAL_INCOME"|"INVESTMENT_VALUE"|"EXCHANGE_PROGRAM"|"MAINTENANCE_FEE_CAP"|"PERPETUITY_CONCEALMENT"|"RESCISSION_CONCEALMENT"|"PRESSURE_TACTICS"|"OTHER",
      "what_was_told_to_client": string,      // first person: "I was told..."
      "what_contract_actually_says": string,  // verbatim or summary of contract language
      "contract_page_reference": string,      // "Page X, Section Y.Z" or "Unknown - not in contract"
      "applicable_statute": string,           // specific statute citation
      "is_verified_by_contract_text": boolean
    }}
  ],
  "was_informed_of_rescission_period": boolean,
  "rescission_period_days_stated": number | null,
  "actual_rescission_period_by_law": number,
  "rescission_window_expired_before_awareness": boolean,
  "was_subjected_to_pressure_tactics": boolean,
  "pressure_tactic_descriptions": [string],
  "declaration_text": string  // full formatted legal declaration with attestation clause
}}

Return ONLY valid JSON. No preamble."""

        return await self._call_claude(prompt, ClientDeclaration)  # type: ignore[return-value]

    def _system_prompt(self) -> str:
        return (
            "You are drafting a sworn declaration for a timeshare owner that their "
            "attorney will use as a foundation for legal action. This declaration "
            "will potentially be submitted to a court or regulatory body.\n\n"
            "Critical requirements:\n"
            "- Each misrepresentation must be stated in first person (\"I was told...\")\n"
            "- Each statement must cross-reference the specific contract clause that "
            "contradicts it, with the exact page and section number\n"
            "- Do NOT embellish or add claims not supported by the client's intake data "
            "and contract analysis\n"
            "- The declaration must be formatted as an actual legal declaration with "
            "a proper attestation clause at the end: \"I declare under penalty of "
            "perjury under the laws of [State] that the foregoing is true and correct. "
            "Executed on _____ at _____, [State].\"\n"
            "- Number every factual statement\n"
            "- Flag any statement where the client's recollection cannot be independently "
            "verified by the contract text — the attorney must know what is corroborated "
            "and what rests solely on client testimony\n\n"
            "Return ONLY valid JSON matching the ClientDeclaration schema. No preamble."
        )
