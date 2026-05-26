from __future__ import annotations

import json
from datetime import datetime

from app.assemblers.base import BaseAssembler
from app.models.evidence_pack import ExecutiveSummary


class ExecutiveSummaryAssembler(BaseAssembler):
    """
    Section 1: Executive Summary — attorney go/no-go in 5 minutes.
    """

    async def assemble(self) -> ExecutiveSummary:
        ctx = self.ctx
        exposure = ctx.outstanding_mortgage + ctx.maintenance_fee_annual * 30

        prompt = f"""You are preparing an executive summary for an attorney who has never seen this case.

Case data:
{json.dumps({
    "case_id": ctx.case_id,
    "client_name": f"{ctx.client_first_name} {ctx.client_last_name}",
    "resort_name": ctx.resort_name,
    "resort_developer": ctx.resort_developer,
    "resort_state": ctx.resort_state,
    "purchase_date": ctx.purchase_date,
    "purchase_price": ctx.purchase_price,
    "maintenance_fee_annual": ctx.maintenance_fee_annual,
    "outstanding_mortgage": ctx.outstanding_mortgage,
    "total_financial_exposure": exposure,
    "misrepresentation_claims": ctx.misrepresentation_claims,
    "case_status": ctx.case_status,
    "exit_track": ctx.exit_track,
    "probability_score": ctx.probability_score,
    "contract_analysis_summary": ctx.contract_analysis,
    "resort_intelligence": ctx.resort_intelligence,
    "negotiation_count": len(ctx.negotiations),
}, indent=2)}

Return a JSON object matching this exact schema:
{{
  "client_full_name": string,
  "case_id": string,
  "pack_generated_date": string,  // ISO date today
  "resort_name": string,
  "resort_developer": string,
  "purchase_date": string,
  "purchase_price": number,
  "current_maintenance_fee_annual": number,
  "outstanding_mortgage": number,
  "total_financial_exposure": number,
  "primary_legal_grounds": [string, string, string],  // top 3, specific statute names
  "case_strength_rating": "STRONG" | "MODERATE" | "BORDERLINE",
  "recommended_immediate_action": string,
  "key_deadlines": [
    {{
      "description": string,
      "date": string | null,
      "is_missed": boolean,
      "legal_significance": string
    }}
  ],
  "one_page_narrative": string  // 300-500 words, professional legal brief prose
}}

Return ONLY valid JSON. No preamble."""

        return await self._call_claude(prompt, ExecutiveSummary)  # type: ignore[return-value]

    def _system_prompt(self) -> str:
        return (
            "You are a senior timeshare litigation attorney preparing an executive case "
            "summary for a colleague who has never seen this case. Your summary must "
            "give them everything they need to make a decision on the case in 5 minutes.\n\n"
            "Rules:\n"
            "- Be direct and declarative. No hedging language.\n"
            "- If the case is strong, say so clearly and state why.\n"
            "- If there are weaknesses, name them explicitly — do not hide them.\n"
            "- Use the actual statute names and citations, not generalities.\n"
            "- The one-page narrative must read as a professional legal brief, "
            "not a consumer complaint. The attorney receiving this is your peer.\n"
            "- Identify every deadline the attorney must know about, including any "
            "statute of limitations issues, rescission window violations, and any "
            "regulatory filing deadlines.\n\n"
            "Return ONLY valid JSON matching the ExecutiveSummary schema. No preamble."
        )
