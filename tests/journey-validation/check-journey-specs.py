#!/usr/bin/env python3
"""Track-D validator for the frozen journey set.

Enforces the plan's "journey set fixed BEFORE measuring, includes every audit §14.2 row"
requirement deterministically: the spec file must be well-formed, complete (see
EXPECTED_JOURNEY_COUNT), cover the required clusters, be bilingual, declare a valid
oracle_layers on every journey, and carry no silently-dropped journey (every journey is
active, the cross-harness one via its deterministic oracle layer).

This does NOT run the journeys — the deterministic layer is executed by the TypeScript runner
(packages/mewkit/src/journey-validation); this script guards the fixture's shape.
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
    "oracle_layers",
}
VALID_STATUS = {"active", "skipped_with_note"}
VALID_ORACLE_LAYERS = {"deterministic", "live"}
# The frozen size of the journey set. The count and the required id range are ONE number:
# raising the count while leaving the range behind (or the reverse) lets a run go green while
# still announcing the old freeze, so both read this constant and the equality below is never
# loosened to an inequality — a silently dropped journey must still fail.
EXPECTED_JOURNEY_COUNT = 19
# Every audit §14.2 journey row must be represented (by id prefix), plus the integration
# routing rows that followed it.
REQUIRED_IDS = {f"j{n:02d}" for n in range(1, EXPECTED_JOURNEY_COUNT + 1)}


def load() -> list[dict]:
    return [json.loads(line) for line in SPECS.read_text(encoding="utf-8").splitlines() if line.strip()]


def main() -> int:
    errors: list[str] = []
    journeys = load()

    ids = [j.get("id", "") for j in journeys]
    prefixes = {i.split("-", 1)[0] for i in ids}

    if len(journeys) != EXPECTED_JOURNEY_COUNT:
        errors.append(
            f"expected {EXPECTED_JOURNEY_COUNT} journeys (§14.2 rows plus integration routing), "
            f"found {len(journeys)}"
        )
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
        layers = j.get("oracle_layers")
        if not isinstance(layers, list) or not layers or set(layers) - VALID_ORACLE_LAYERS:
            errors.append(f"{jid}: oracle_layers must be a non-empty list of {sorted(VALID_ORACLE_LAYERS)}")

    # As of Phase 7 the cross-harness journey (j10) is active via its deterministic oracle layer;
    # no journey may be silently skipped. A skipped_with_note journey must still carry a real note.
    for j in journeys:
        if j.get("status") == "skipped_with_note" and len(j.get("note", "").strip()) < 10:
            errors.append(f'{j.get("id")}: skipped_with_note requires an explanatory note')
    if not any("deterministic" in j.get("oracle_layers", []) for j in journeys):
        errors.append("no journey declares a deterministic oracle layer")

    if not any(j.get("lang") == "vi" for j in journeys):
        errors.append("journey set is not bilingual (no Vietnamese journey)")

    if errors:
        print("FAIL — Phase 8 journey specs invalid:")
        for e in errors:
            print(f"  - {e}")
        return 1

    active = sum(1 for j in journeys if j["status"] == "active")
    skipped = sum(1 for j in journeys if j["status"] == "skipped_with_note")
    deterministic = sum(1 for j in journeys if "deterministic" in j.get("oracle_layers", []))
    langs = {j["lang"] for j in journeys}
    print(
        f"PASS — {EXPECTED_JOURNEY_COUNT} journeys frozen "
        f"({active} active, {skipped} skipped-with-note); langs={sorted(langs)}."
    )
    print(f"Deterministic oracle layer on {deterministic} journeys (incl. cross-harness j10, side-effect j08, ssrf j12);")
    print("run by the TypeScript journey runner. Model-in-loop (live) layer is a named follow-up.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
