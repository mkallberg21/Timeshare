from __future__ import annotations

import json
from app.assemblers.base import BaseAssembler
from app.models.evidence_pack import ResortProfileSection
from app.legal.precedents import get_known_regulatory_actions


class ResortProfileAssembler(BaseAssembler):
    """Section 7: Resort profile — resistance, intelligence, vulnerabilities."""

    async def assemble(self) -> ResortProfileSection:
        ctx = self.ctx
        intel = ctx.resort_intelligence or {}
        known_actions = get_known_regulatory_actions(ctx.resort_name)

        prompt = f"""Build an attorney-ready resort intelligence profile for this case.

Resort intelligence data from resort-intelligence service:
{json.dumps(intel, indent=2)}

Known regulatory actions (hardcoded intelligence database):
{json.dumps(known_actions, indent=2)}

Resort name: {ctx.resort_name}
Developer: {ctx.resort_developer}
State: {ctx.resort_state}

Return a JSON object matching this exact schema:
{{
  "resort_name": string,
  "developer_name": string,
  "developer_parent_company": string | null,
  "resort_state": string,
  "resistance_score": number,    // 0-1 (0=cooperative, 1=litigious)
  "receptivity_score": number,   // 0-1 (0=hostile to deed-backs, 1=open)
  "historical_deed_back_acceptance": boolean,
  "avg_days_to_resolution": number,
  "historical_success_rate": number,
  "known_vulnerabilities": [string],  // legal weaknesses this resort has shown
  "prior_regulatory_actions": [
    {{
      "agency": string,
      "year": number,
      "description": string,
      "outcome": string,
      "settlement_amount": number | null,
      "source_url": string | null
    }}
  ],
  "cfpb_complaint_count": number | null,
  "bbb_rating": string | null,
  "bbb_complaint_count": number | null,
  "negotiation_intelligence": string,  // how this resort typically responds
  "recommended_approach": string,      // based on historical data
  "contact_for_deed_back": string | null
}}

Return ONLY valid JSON. No preamble."""

        return await self._call_claude(prompt, ResortProfileSection)  # type: ignore[return-value]

    def _system_prompt(self) -> str:
        return (
            "You are providing resort intelligence analysis for a timeshare exit attorney. "
            "Your job is to synthesize all available data about this resort developer into "
            "actionable intelligence that tells the attorney exactly how to approach this case.\n\n"
            "Known vulnerabilities: Focus on legal weaknesses this resort or developer "
            "has demonstrated — prior consent orders, regulatory settlements, pattern "
            "violations, known weaknesses in their exit programs.\n\n"
            "Negotiation intelligence: Based on the data provided, describe how this resort "
            "typically responds to demand letters, what their opening position usually is, "
            "and what typically moves them toward settlement.\n\n"
            "Only include regulatory actions you are confident about. Do not fabricate "
            "settlements or consent orders. If you are not certain, leave the array with "
            "what is provided in the data.\n\n"
            "Return ONLY valid JSON matching the ResortProfileSection schema. No preamble."
        )
