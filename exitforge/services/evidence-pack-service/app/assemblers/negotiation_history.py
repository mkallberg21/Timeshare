from __future__ import annotations

import json
from app.assemblers.base import BaseAssembler
from app.models.evidence_pack import NegotiationHistorySection


class NegotiationHistoryAssembler(BaseAssembler):
    """Section 8: Negotiation history — rounds, responses, pattern analysis."""

    async def assemble(self) -> NegotiationHistorySection:
        ctx = self.ctx

        prompt = f"""Summarize the negotiation history for this timeshare exit case.

Case status: {ctx.case_status}
Exit track: {ctx.exit_track}

Negotiation rounds (from case-service):
{json.dumps(ctx.negotiations, indent=2)}

Resort resistance score: {(ctx.resort_intelligence or {}).get("resistance_score", 0.5)}

Return a JSON object matching this exact schema:
{{
  "total_rounds": number,
  "current_status": string,
  "rounds": [
    {{
      "round_number": number,
      "track": string,
      "letter_sent_date": string | null,
      "response_date": string | null,
      "response_type": string | null,  // ACCEPTED|REJECTED|COUNTER|LEGAL_THREAT|NO_RESPONSE
      "summary_of_resort_response": string | null,
      "letter_s3_key": string
    }}
  ],
  "resort_response_pattern": string,   // AI analysis of how resort has responded
  "recommended_next_step": string      // concrete next action recommendation
}}

Return ONLY valid JSON. No preamble."""

        return await self._call_claude(prompt, NegotiationHistorySection)  # type: ignore[return-value]

    def _system_prompt(self) -> str:
        return (
            "You are analyzing the negotiation history of a timeshare exit case to "
            "provide an attorney with a clear picture of where things stand.\n\n"
            "Your resort_response_pattern analysis should identify:\n"
            "- Whether the resort is engaging or stonewalling\n"
            "- Any pattern of delay tactics\n"
            "- Whether their responses indicate openness to settlement\n"
            "- How their behavior compares to known patterns for this type of resort\n\n"
            "Your recommended_next_step must be concrete and actionable — not \"continue "
            "negotiations\" but rather a specific action with rationale.\n\n"
            "Return ONLY valid JSON matching the NegotiationHistorySection schema. No preamble."
        )
