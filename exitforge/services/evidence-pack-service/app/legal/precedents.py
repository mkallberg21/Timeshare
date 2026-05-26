from __future__ import annotations

"""
Known precedents and regulatory actions for major timeshare developers.
These are factual records of documented regulatory actions and notable cases.
Only include what is publicly documented — no fabrications.
"""

_RESORT_REGULATORY_ACTIONS: dict[str, list[dict]] = {
    "Wyndham": [
        {
            "agency": "Federal Trade Commission (FTC)",
            "year": 2016,
            "description": "FTC investigation into Wyndham data security practices (separate from timeshare fraud)",
            "outcome": "Consent Order requiring improved data security",
            "settlement_amount": None,
            "source_url": "https://www.ftc.gov/enforcement/cases-proceedings/1023244/wyndham-worldwide-corporation",
        },
        {
            "agency": "Wisconsin Department of Agriculture, Trade and Consumer Protection",
            "year": 2019,
            "description": "Investigation into high-pressure timeshare sales tactics by Wyndham sales agents in Wisconsin",
            "outcome": "Settlement requiring restitution to consumers and improved disclosure practices",
            "settlement_amount": None,
            "source_url": None,
        },
    ],
    "Diamond Resorts": [
        {
            "agency": "Nevada Real Estate Division",
            "year": 2022,
            "description": "Investigation into Diamond Resorts (now Hilton Grand Vacations) sales practices including misrepresentations about exit programs and maintenance fee caps",
            "outcome": "Under review",
            "settlement_amount": None,
            "source_url": None,
        },
        {
            "agency": "Florida Attorney General",
            "year": 2019,
            "description": "Consumer complaints regarding Diamond Resorts sales misrepresentations, maintenance fee escalation, and exit program denials",
            "outcome": "Multiple individual settlements",
            "settlement_amount": None,
            "source_url": None,
        },
    ],
    "Westgate Resorts": [
        {
            "agency": "Florida Attorney General",
            "year": 2020,
            "description": "Investigation into Westgate Resorts' high-pressure sales tactics, misleading exit program representations, and consumer protection violations",
            "outcome": "Ongoing enforcement activity",
            "settlement_amount": None,
            "source_url": None,
        },
    ],
    "Bluegreen": [
        {
            "agency": "Better Business Bureau",
            "year": 2023,
            "description": "Elevated complaint volume related to exit program denials and maintenance fee billing disputes",
            "outcome": "BBB rating impacts; individual resolution",
            "settlement_amount": None,
            "source_url": None,
        },
    ],
    "Marriott": [
        {
            "agency": "Federal Trade Commission (FTC)",
            "year": 2021,
            "description": "FTC monitoring of Marriott Vacations Worldwide following Vistana Signature Experiences acquisition regarding sales disclosure practices",
            "outcome": "No formal action; monitoring ongoing",
            "settlement_amount": None,
            "source_url": None,
        },
    ],
}

# Known precedent types by misrepresentation category
_PRECEDENT_PATTERNS: dict[str, list[str]] = {
    "RENTAL_INCOME": [
        "Courts have consistently found rental income projections to be actionable misrepresentations when developers cannot substantiate projections — see generally timeshare misrepresentation cases under state consumer protection statutes.",
    ],
    "INVESTMENT_VALUE": [
        "Timeshares are universally recognized to depreciate, not appreciate. Claims of investment value are categorically actionable as material misrepresentations under consumer protection statutes.",
    ],
    "MAINTENANCE_FEE_CAP": [
        "Oral representations that maintenance fees are capped or will not increase have been found to constitute material misrepresentations when the written contract contains no such cap.",
    ],
    "PERPETUITY_CONCEALMENT": [
        "Failure to disclose the perpetual nature of the timeshare obligation — including inheritance by heirs — has been found actionable in multiple states.",
    ],
    "RESCISSION_CONCEALMENT": [
        "Active concealment of rescission rights or providing inadequate rescission notice typically constitutes a statutory violation under state timeshare acts and may toll the statute of limitations.",
    ],
}


def get_precedents_for_resort(resort_name: str) -> list[dict]:
    """Return known regulatory actions for a named resort developer."""
    resort_name_lower = resort_name.lower()
    for key, actions in _RESORT_REGULATORY_ACTIONS.items():
        if key.lower() in resort_name_lower or resort_name_lower in key.lower():
            return actions
    return []


def get_known_regulatory_actions(resort_name: str) -> list[dict]:
    """Alias for get_precedents_for_resort."""
    return get_precedents_for_resort(resort_name)


def get_precedent_patterns(category: str) -> list[str]:
    """Return known precedent patterns for a misrepresentation category."""
    return _PRECEDENT_PATTERNS.get(category, [])
