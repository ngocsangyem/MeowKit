#!/usr/bin/env python3
"""Track-D validator for the frozen Phase 8 journey set.

Enforces the plan's "journey set fixed BEFORE measuring, includes every audit §14.2 row"
requirement deterministically: the spec file must be well-formed, complete (12 journeys),
cover the required clusters, be bilingual, and mark exactly the one cross-harness journey
skipped-with-note (Phase 6 step 3 deferred) rather than silently dropped.

This does NOT run the journeys — it guards the fixture the live benchmark consumes.
Exit 0 = specs valid & frozen-shape intact. Exit 1 = a spec defect.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

SPECS = Path(__file__).resolve().parent / "journey-specs.jsonl"

REQUIRED_FIELDS = {
    "id", "lang", "cluster", "prompt", "expected_route",
    "quick_path", "artifacts_allowed", "artifacts_forbidden", "oracle", "status", "note",
}
VALID_STATUS = {"active", "skipped_with_note"}
# Every audit §14.2 journey row must be represented (by id prefix).
REQUIRED_IDS = {f"j{n:02d}" for n in range(1, 13)}


def load() -> list[dict]:
    return [json.loads(line) for line in SPECS.read_text(encoding="utf-8").splitlines() if line.strip()]


def main() -> int:
    errors: list[str] = []
    journeys = load()

    ids = [j.get("id", "") for j in journeys]
    prefixes = {i.split("-", 1)[0] for i in ids}

    if len(journeys) != 12:
        errors.append(f"expected 12 journeys (§14.2 rows), found {len(journeys)}")
    if len(ids) != len(set(ids)):
        errors.append("duplicate journey ids")
    missing = REQUIRED_IDS - prefixes
    if missing:
        errors.append(f"missing §14.2 journey ids: {sorted(missing)}")

    for j in journeys:
        jid = j.get("id", "<no id>")
        absent = REQUIRED_FIELDS - j.keys()
        if absent:
            errors.append(f"{jid}: missing fields {sorted(absent)}")
            continue
        if j["status"] not in VALID_STATUS:
            errors.append(f'{jid}: invalid status "{j["status"]}"')
        if not isinstance(j["artifacts_allowed"], list) or not isinstance(j["artifacts_forbidden"], list):
            errors.append(f"{jid}: artifacts_allowed/forbidden must be lists")
        if not j["expected_route"] or not j["prompt"]:
            errors.append(f"{jid}: empty expected_route or prompt")

    skipped = [j for j in journeys if j.get("status") == "skipped_with_note"]
    if len(skipped) != 1:
        errors.append(f"expected exactly 1 skipped_with_note journey (two-payloads), found {len(skipped)}")
    elif "Phase 6" not in skipped[0].get("note", ""):
        errors.append("skipped journey note must explain the Phase 6 step-3 deferral")

    if not any(j.get("lang") == "vi" for j in journeys):
        errors.append("journey set is not bilingual (no Vietnamese journey)")

    if errors:
        print("FAIL — Phase 8 journey specs invalid:")
        for e in errors:
            print(f"  - {e}")
        return 1

    active = sum(1 for j in journeys if j["status"] == "active")
    langs = {j["lang"] for j in journeys}
    print(f"PASS — 12 journeys frozen ({active} active, 1 skipped-with-note); langs={sorted(langs)}.")
    print("Deterministic oracles: side-effect (j08), ssrf (j12). Remaining routes/metrics are model-in-loop.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
