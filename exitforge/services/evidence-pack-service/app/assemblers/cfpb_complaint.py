from __future__ import annotations

import json
from app.assemblers.base import BaseAssembler
from app.models.evidence_pack import CfpbComplaintSection


class CfpbComplaintAssembler(BaseAssembler):
    """
    Section 10: Pre-filled CFPB complaint — ops or attorney submits at cfpb.gov.
    Only generated when misrepresentation evidence is strong.
    """

    async def assemble(self) -> CfpbComplaintSection:
        ctx = self.ctx

        prompt = f"""Draft a pre-filled CFPB complaint for this timeshare case.

Case data:
{json.dumps({
    "resort_name": ctx.resort_name,
    "resort_developer": ctx.resort_developer,
    "resort_state": ctx.resort_state,
    "purchase_date": ctx.purchase_date,
    "purchase_price": ctx.purchase_price,
    "outstanding_mortgage": ctx.outstanding_mortgage,
    "maintenance_fee_annual": ctx.maintenance_fee_annual,
    "misrepresentation_claims": ctx.misrepresentation_claims,
    "client_name": f"{ctx.client_first_name} {ctx.client_last_name}",
}, indent=2)}

The CFPB complaint narrative must be under 2000 characters and optimized
for CFPB review: factual, specific, avoids legal jargon, states what happened
and what resolution is sought.

Return a JSON object matching this exact schema:
{{
  "product_type": "Mortgage",
  "issue_category": string,     // CFPB issue category (use "Applying for a mortgage or refinancing an existing mortgage" or "Trouble during payment process" etc.)
  "sub_issue": string,
  "complaint_narrative": string,   // under 2000 chars
  "desired_resolution": string,
  "company_cfpb_name": string,     // exact company name as registered with CFPB
  "company_address": string,
  "filing_instructions": string    // step-by-step how to submit at cfpb.gov
}}

Return ONLY valid JSON. No preamble."""

        return await self._call_claude(prompt, CfpbComplaintSection)  # type: ignore[return-value]

    def _system_prompt(self) -> str:
        return (
            "You are preparing a CFPB complaint on behalf of a timeshare consumer. "
            "The CFPB regulates timeshare mortgage loans under its mortgage authority.\n\n"
            "The complaint narrative must:\n"
            "- Be under 2000 characters (CFPB limit)\n"
            "- Be factual and specific — no legal arguments\n"
            "- State clearly: who did what, when, and what the consumer wants\n"
            "- Avoid legal jargon — write for a consumer protection examiner\n\n"
            "The company_cfpb_name must be the exact legal name as it would appear "
            "in CFPB's company database. For major developers: 'Wyndham Vacation "
            "Ownership, Inc.', 'Marriott Ownership Resorts, Inc.', etc.\n\n"
            "Return ONLY valid JSON matching the CfpbComplaintSection schema. No preamble."
        )
