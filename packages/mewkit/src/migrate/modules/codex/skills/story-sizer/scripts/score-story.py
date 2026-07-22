#!/usr/bin/env python3
"""score-story.py — deterministic Fibonacci sizing per StoryRecord.

Reads a JSON payload of the form:

    {
      "records": [ StoryRecord, ... ],
      "scout_context": {...} | null,         # optional codebase signals
      "agile_loaded": true | false           # toggles DoR advisory
    }

Emits JSON with the original records enriched with a `sizing` field:

    {
      "records": [
        {
          ...StoryRecord fields...,
          "sizing": {
            "points": 1|2|3|5|8|13|None,
            "uncertainty": "±N",
            "complexity": "low"|"medium"|"high"|"very-high",
            "drivers_score": int,
            "dimension_scores": {ac_count, integration, novelty, code_volume, cross_module},
            "inconsistencies": [...],
            "split_proposal": {...} | None,
            "codebase_signals": {...} | None,
            "dor_status": {...} | None,
            "refusal_reason": str | None
          }
        }
      ]
    }

Math is integer arithmetic over text-derived counts — no LLM randomness.
"""
from __future__ import annotations

import difflib
import json
import re
import sys
from typing import Any, Optional

EXTERNAL_VERBS = (
    "oauth", "saml", "sso", "webhook", "stripe", "paypal", "sepay",
    "twilio", "sendgrid", "s3", "gcs", "kms", "cognito", "okta",
    "google", "apple", "facebook", "api", "email", "sms",
    "push notification",
)
INTERNAL_VERBS = (
    "fetch", "read", "query", "update", "display", "render",
    "validate", "compute", "transform",
)
RISK_VERBS = ("migrate", "refactor", "rewrite", "breaking", "deprecate", "replace")
AREA_MARKERS = (
    "auth", "billing", "notification", "profile", "dashboard",
    "search", "report", "admin", "settings", "onboarding",
    "checkout", "cart",
)
FIB_TABLE = [
    (3, 1, "low", 0),
    (5, 2, "low", 1),
    (7, 3, "medium", 1),
    (9, 5, "medium", 2),
    (11, 8, "high", 3),
    (15, 13, "very-high", 5),
]


def _lower_text(record: dict) -> str:
    parts = [record.get("title", ""), record.get("description", "")]
    parts.extend(record.get("acceptance_criteria", []) or [])
    return " ".join(parts).lower()


def _count_substring_matches(haystack: str, needles: tuple[str, ...]) -> int:
    return sum(1 for n in needles if n in haystack)


def _ac_score(ac_count: int) -> int:
    if ac_count == 0:
        return 0
    if ac_count <= 2:
        return 1
    if ac_count <= 4:
        return 2
    return 3


def _integration_score(text: str) -> int:
    external_hits = _count_substring_matches(text, EXTERNAL_VERBS)
    if external_hits >= 2:
        return 3
    if external_hits == 1:
        return 2
    if _count_substring_matches(text, INTERNAL_VERBS) >= 1:
        return 1
    return 0


def _novelty_score(text: str, scout: Optional[dict]) -> int:
    risk_hits = _count_substring_matches(text, RISK_VERBS)
    if not scout:
        return 1 + min(risk_hits, 2)
    matches_pattern = bool(scout.get("matches_existing_pattern", False))
    new_tech = bool(scout.get("net_new_technology", False))
    if new_tech:
        return 3
    if matches_pattern:
        return 0 + min(risk_hits, 2)
    return 2


def _code_volume_score(record: dict) -> int:
    acs = record.get("acceptance_criteria", []) or []
    description = record.get("description", "") or ""
    nouns = re.findall(r"\b[A-Z][a-z]+\b", description)
    volume_index = 2 * len(acs) + min(len(nouns), 20)
    if volume_index < 6:
        return 0
    if volume_index < 14:
        return 1
    if volume_index < 22:
        return 2
    return 3


def _cross_module_score(text: str) -> tuple[int, list[str]]:
    distinct_areas = sorted({a for a in AREA_MARKERS if a in text})
    n = len(distinct_areas)
    if n <= 1:
        return 0, distinct_areas
    if n == 2:
        return 1, distinct_areas
    if n == 3:
        return 2, distinct_areas
    return 3, distinct_areas


def _fibonacci_from_score(score: int) -> tuple[int, str, int]:
    for limit, points, complexity, uncert in FIB_TABLE:
        if score <= limit:
            return points, complexity, uncert
    return 13, "very-high", 5


def _detect_inconsistencies(record: dict, distinct_areas: list[str]) -> list[str]:
    out: list[str] = []
    acs = record.get("acceptance_criteria", []) or []

    for i in range(len(acs)):
        for j in range(i + 1, len(acs)):
            ratio = difflib.SequenceMatcher(None, acs[i].lower(), acs[j].lower()).ratio()
            if ratio >= 0.7:
                tokens_i = set(re.findall(r"[a-z0-9/_-]+", acs[i].lower()))
                tokens_j = set(re.findall(r"[a-z0-9/_-]+", acs[j].lower()))
                diff = tokens_i.symmetric_difference(tokens_j)
                if 1 <= len(diff) <= 3:
                    out.append(
                        f"AC pair near-duplicate but differs on: {sorted(diff)} "
                        f"(ACs {i + 1} vs {j + 1})"
                    )

    description = (record.get("description") or "").lower()
    ac_join = " ".join(acs).lower()
    for verb in EXTERNAL_VERBS:
        if verb in description and verb not in ac_join:
            out.append(f"description references '{verb}' but no AC covers it")

    if len(distinct_areas) > 2:
        out.append(f"story mixes {len(distinct_areas)} concerns: {distinct_areas}")

    return out


def _propose_split(record: dict, distinct_areas: list[str], points: int, uncertainty: int) -> Optional[dict]:
    triggers: list[str] = []
    if points >= 13:
        triggers.append("size")
    if len(distinct_areas) > 2:
        triggers.append("concerns")
    if uncertainty > 3:
        triggers.append("uncertainty")
    if not triggers:
        return None

    base_title = record.get("title", "")
    areas = distinct_areas[:3] if distinct_areas else ["core", "edges", "polish"]
    sub_stories = []
    for area in areas:
        sub_stories.append({
            "title": f"{base_title} — {area}",
            "focus": area,
            "est_points": max(1, points // max(len(areas), 2)),
        })

    return {
        "trigger": triggers[0],
        "all_triggers": triggers,
        "sub_stories": sub_stories,
        "rationale": (
            f"Story scores {points} pts ({len(distinct_areas)} concerns, ±{uncertainty}). "
            f"Suggest splitting along: {', '.join(areas)}."
        ),
    }


def _dor_status(record: dict) -> dict:
    description = (record.get("description") or "").lower()
    title = (record.get("title") or "").lower()
    acs = record.get("acceptance_criteria", []) or []
    combined = f"{title}\n{description}"

    has_user = bool(re.search(r"\bas a[n]? \w+", combined)) or "user" in combined or "customer" in combined
    has_benefit = "so that" in combined or "in order to" in combined
    testable = bool(acs) and all(
        any(token in ac.lower() for token in ("when", "then", "should", "shall", "must"))
        or len(ac.split()) >= 4
        for ac in acs
    )
    deps_named = any(
        token in combined for token in ("depends on", "requires", "blocked by", "after ", "prerequisite")
    )

    reasons = []
    if not has_user:
        reasons.append("no user-role phrase")
    if not has_benefit:
        reasons.append("no benefit phrase ('so that …')")
    if not testable:
        reasons.append("ACs not observably testable")
    if not deps_named:
        reasons.append("no dependency mention")

    return {
        "has_user_phrase": has_user,
        "has_benefit_phrase": has_benefit,
        "testable_acs": testable,
        "dependencies_named": deps_named,
        "verdict": "ready" if not reasons else "not-ready",
        "reasons": reasons,
    }


def size_record(record: dict, scout: Optional[dict], agile_loaded: bool) -> dict:
    if "[NO_ACS]" in (record.get("flags") or []):
        return {
            "points": None,
            "uncertainty": "±0",
            "complexity": "n/a",
            "drivers_score": 0,
            "dimension_scores": {},
            "inconsistencies": [],
            "split_proposal": None,
            "codebase_signals": scout or None,
            "dor_status": _dor_status(record) if agile_loaded else None,
            "refusal_reason": "missing acceptance criteria",
        }

    text = _lower_text(record)
    acs = record.get("acceptance_criteria", []) or []
    deduped_acs = list(dict.fromkeys(ac.strip() for ac in acs))
    if len(deduped_acs) < len(acs):
        ac_count = len(deduped_acs)
    else:
        ac_count = len(acs)

    ac_s = _ac_score(ac_count)
    integ_s = _integration_score(text)
    nov_s = _novelty_score(text, scout)
    vol_s = _code_volume_score(record)
    cross_s, distinct_areas = _cross_module_score(text)

    if any(v in text for v in RISK_VERBS):
        nov_s = min(3, nov_s + 1)

    drivers = ac_s + integ_s + nov_s + vol_s + cross_s

    inconsistencies = _detect_inconsistencies(record, distinct_areas)

    if drivers == 0 and not distinct_areas:
        return {
            "points": None,
            "uncertainty": "±0",
            "complexity": "n/a",
            "drivers_score": 0,
            "dimension_scores": {
                "ac_count": ac_s, "integration": integ_s, "novelty": nov_s,
                "code_volume": vol_s, "cross_module": cross_s,
            },
            "inconsistencies": inconsistencies,
            "split_proposal": None,
            "codebase_signals": scout or None,
            "dor_status": _dor_status(record) if agile_loaded else None,
            "refusal_reason": "no signal",
        }

    points, complexity, uncertainty = _fibonacci_from_score(drivers)
    split = _propose_split(record, distinct_areas, points, uncertainty)

    return {
        "points": points,
        "uncertainty": f"±{uncertainty}",
        "complexity": complexity,
        "drivers_score": drivers,
        "dimension_scores": {
            "ac_count": ac_s, "integration": integ_s, "novelty": nov_s,
            "code_volume": vol_s, "cross_module": cross_s,
        },
        "inconsistencies": inconsistencies,
        "split_proposal": split,
        "codebase_signals": scout or None,
        "dor_status": _dor_status(record) if agile_loaded else None,
        "refusal_reason": None,
    }


def main(argv: list[str]) -> int:
    if len(argv) > 1 and argv[1] != "-":
        with open(argv[1], "r", encoding="utf-8") as handle:
            payload = json.load(handle)
    else:
        payload = json.load(sys.stdin)

    scout = payload.get("scout_context")
    agile_loaded = bool(payload.get("agile_loaded", False))
    records = payload.get("records", [])

    sized: list[dict[str, Any]] = []
    for record in records:
        record = dict(record)
        record["sizing"] = size_record(record, scout, agile_loaded)
        sized.append(record)

    print(json.dumps({"records": sized}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
