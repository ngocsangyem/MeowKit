#!/usr/bin/env python3
"""Routing eval runner (Track D, offline, no model).

Asserts the deterministic Track-D cases in `routing-cases.jsonl` against the documented
task-type classifier (`classify.py`). Track-M cases (Vietnamese intent without a literal
English signal, and fine cluster boundaries such as fix vs build-fix vs investigate) require
a model and are reported but NOT asserted here — they are the fixture set an opt-in model
runner consumes. Also fails on classifier↔doc drift.

Exit 0 = all Track-D cases pass and no drift. Exit 1 = a Track-D mismatch or drift.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from classify import classify, drift_check  # noqa: E402

CASES = Path(__file__).resolve().parent / "routing-cases.jsonl"


def load_cases() -> list[dict]:
    return [json.loads(line) for line in CASES.read_text(encoding="utf-8").splitlines() if line.strip()]


def main() -> int:
    drift = drift_check()
    if drift:
        print("DRIFT: classifier keywords no longer match task-type-classification.md:")
        for message in drift:
            print(f"  - {message}")
        return 1

    cases = load_cases()
    track_d = [c for c in cases if c["track"] == "D"]
    track_m = [c for c in cases if c["track"] == "M"]
    failures: list[str] = []

    for case in track_d:
        task_type, skill = classify(case["prompt"])
        if task_type != case["expected_task_type"] or skill != case["expected_suggested_skill"]:
            failures.append(
                f'  {case["id"]} [{case["lang"]}]: got ({task_type}, {skill}), '
                f'expected ({case["expected_task_type"]}, {case["expected_suggested_skill"]})'
            )

    def lang_counts(rows: list[dict]) -> str:
        en = sum(1 for r in rows if r["lang"] == "en")
        vi = sum(1 for r in rows if r["lang"] == "vi")
        return f"{en} en / {vi} vi"

    print(f"Track D (deterministic, asserted): {len(track_d)} cases [{lang_counts(track_d)}]")
    print(f"Track M (model-in-loop, fixtures only): {len(track_m)} cases [{lang_counts(track_m)}]")

    if failures:
        print(f"\nFAIL — {len(failures)} Track-D routing mismatch(es):")
        print("\n".join(failures))
        return 1

    print(f"\nPASS — all {len(track_d)} Track-D routing cases classified as documented.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
