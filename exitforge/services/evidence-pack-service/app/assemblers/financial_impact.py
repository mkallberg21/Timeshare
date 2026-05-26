from __future__ import annotations

import json
from app.assemblers.base import BaseAssembler
from app.models.evidence_pack import FinancialImpactSection


class FinancialImpactAssembler(BaseAssembler):
    """Section 6: Financial impact — total damages calculation."""

    async def assemble(self) -> FinancialImpactSection:
        ctx = self.ctx
        # Compute projections from maintenance fee
        fee = ctx.maintenance_fee_annual
        fee_5yr = round(fee * (1.05 ** 5), 2)   # 5% annual increase
        fee_10yr = round(fee * (1.05 ** 10), 2)
        lifetime_fee = round(sum(fee * (1.05 ** y) for y in range(30)), 2)

        prompt = f"""Calculate financial impact and damages for this timeshare exit case.

Financial data:
{json.dumps({
    "purchase_price": ctx.purchase_price,
    "outstanding_mortgage": ctx.outstanding_mortgage,
    "maintenance_fee_annual": ctx.maintenance_fee_annual,
    "maintenance_fee_projected_5_years": fee_5yr,
    "maintenance_fee_projected_10_years": fee_10yr,
    "lifetime_exposure_30_years": lifetime_fee,
    "resort_state": ctx.resort_state,
    "contract_year": ctx.contract_year,
    "misrepresentation_claims": ctx.misrepresentation_claims,
}, indent=2)}

Return a JSON object matching this exact schema:
{{
  "purchase_price": number,
  "down_payment": number | null,
  "financed_amount": number | null,
  "current_mortgage_balance": number,
  "interest_paid_to_date": number | null,
  "maintenance_fee_current_year": number,
  "maintenance_fee_historical_avg_increase": number | null,  // % per year
  "maintenance_fee_projected_5_years": number,
  "maintenance_fee_projected_10_years": number,
  "total_paid_to_date": number,
  "total_exposure_if_no_exit": number,  // lifetime cost projection
  "estimated_damages_claim": number,
  "damages_breakdown": [
    {{
      "description": string,
      "amount": number,
      "legal_basis": string,
      "is_special_damages": boolean
    }}
  ],
  "financial_hardship_narrative": string | null
}}

Return ONLY valid JSON. No preamble."""

        return await self._call_claude(prompt, FinancialImpactSection)  # type: ignore[return-value]

    def _system_prompt(self) -> str:
        return (
            "You are calculating financial damages for a timeshare consumer protection case. "
            "Your job is to quantify every dollar of harm this client has suffered and "
            "will suffer if the exit is not granted.\n\n"
            "Include all available damages categories:\n"
            "- Direct economic damages: amounts paid under the contract\n"
            "- Consequential damages: projected future costs\n"
            "- Rescissionary damages: purchase price return if contract is void\n"
            "- Statutory damages: where the state statute provides for them\n"
            "- Attorney fees: if available under applicable statutes\n\n"
            "Use conservative estimates for claims that depend on assumptions. "
            "Use the 5% annual maintenance fee increase as the default if no "
            "historical data is available.\n\n"
            "Return ONLY valid JSON matching the FinancialImpactSection schema. No preamble."
        )
