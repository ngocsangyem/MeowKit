#!/usr/bin/env python3
"""recompute-score.py — recompute an evaluator verdict's weighted score from the
CANONICAL rubric preset and verify overall/score/coverage consistency.

The verdict file is author-controlled (the evaluator agent writes it), so its
declared `weighted_score` / `overall` / per-rubric weights are UNTRUSTED. This
script recomputes the score from:
  - the preset's weights            (.claude/rubrics/composition-presets/<preset>.md)
  - each rubric's hard_fail_threshold (.claude/rubrics/<rubric>.md)
  - the per-rubric VERDICTS parsed from the verdict's "### <name> ... — <VERDICT>" headers

and rejects a verdict whose declared score/overall does not follow from its own
per-rubric verdicts, or whose rubric set does not exactly cover the preset. This is
what turns the audit's forged verdict (PASS + weighted_score 0.01 + junk evidence)
from "accepted" into "rejected": either its per-rubric coverage is wrong, or its
declared score/overall cannot be derived from its rubric verdicts.

Scoring model (single source of truth: evaluate/step-04-grade-and-verdict.md):
  PASS=1.0 · WARN=0.5 · FAIL=0.0 ; weighted = Σ(weight × value)
  overall: hard_fail ⇒ FAIL ; ≥0.85 PASS ; ≥0.65 WARN ; else FAIL

Usage: recompute-score.py <verdict.md> [--rubrics-dir DIR]
Exit 0 = consistent; 1 = VERDICT_INVALID (reasons on stdout as JSON); 2 = usage/IO error.
Emits a JSON object on stdout either way (ok:true/false + fields).
"""
import argparse
import json
import os
import re
import sys

VALUE = {"PASS": 1.0, "WARN": 0.5, "FAIL": 0.0}
ORDER = {"PASS": 0, "WARN": 1, "FAIL": 2}  # severity ordering for hard-fail comparison
PASS_THRESHOLD = 0.85
WARN_THRESHOLD = 0.65
SCORE_TOLERANCE = 0.01


def read_frontmatter(path):
    """Return the YAML-ish frontmatter block as raw text (between the first two ---)."""
    with open(path, encoding="utf-8") as f:
        text = f.read()
    m = re.match(r"^---\n(.*?)\n---\n", text, re.DOTALL)
    return (m.group(1) if m else ""), text


def fm_field(fm, key):
    m = re.search(rf"^{re.escape(key)}:[ \t]*(.*)$", fm, re.MULTILINE)
    return m.group(1).strip() if m else None


def parse_preset(preset_path):
    """Return {rubric_name: weight} from a composition preset's frontmatter."""
    fm, _ = read_frontmatter(preset_path)
    weights = {}
    # Block list under `rubrics:` — `  - name: x` / `    weight: 0.3`
    cur = None
    in_rubrics = False
    for line in fm.splitlines():
        if re.match(r"^rubrics:\s*$", line):
            in_rubrics = True
            continue
        if in_rubrics and re.match(r"^[A-Za-z_]", line):  # dedented key ⇒ block ended
            in_rubrics = False
        if not in_rubrics:
            continue
        mname = re.match(r"^\s*-\s*name:\s*(.+?)\s*$", line)
        if mname:
            cur = mname.group(1)
            continue
        mw = re.match(r"^\s*weight:\s*([0-9.]+)\s*$", line)
        if mw and cur:
            weights[cur] = float(mw.group(1))
            cur = None
    return weights


def rubric_threshold(rubrics_dir, name):
    """hard_fail_threshold for a rubric (default FAIL if the file/field is absent)."""
    path = os.path.join(rubrics_dir, f"{name}.md")
    if not os.path.isfile(path):
        return "FAIL"
    fm, _ = read_frontmatter(path)
    return (fm_field(fm, "hard_fail_threshold") or "FAIL").upper()


def parse_verdict_rubrics(text):
    """Return {rubric_name: VERDICT} from '### <name> (...) — <VERDICT>' headers.
    Duplicates are collected so coverage can flag them."""
    found = []
    for line in text.splitlines():
        if not line.startswith("### "):
            continue
        mname = re.match(r"^###\s+([a-z][a-z0-9-]*)", line)
        if not mname:
            continue
        mv = re.search(r"\b(PASS|WARN|FAIL)\s*$", line.strip())
        if not mv:
            continue
        found.append((mname.group(1), mv.group(1)))
    return found


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("verdict")
    ap.add_argument("--rubrics-dir", default=".claude/rubrics")
    args = ap.parse_args()

    result = {"ok": False, "reasons": []}

    if not os.path.isfile(args.verdict):
        print(json.dumps({"ok": False, "reasons": [f"verdict not found: {args.verdict}"]}))
        return 2

    fm, text = read_frontmatter(args.verdict)
    preset = fm_field(fm, "rubric_preset")
    declared_overall = (fm_field(fm, "overall") or "").upper()
    declared_score_raw = fm_field(fm, "weighted_score")
    declared_hf_raw = (fm_field(fm, "hard_fail_triggered") or "").lower()

    if not preset:
        result["reasons"].append("missing rubric_preset in frontmatter")
        print(json.dumps(result))
        return 1

    # A preset name is a bare identifier — never a path. Reject separators / traversal so a crafted
    # verdict cannot point the weight source at an attacker-writable file outside the presets dir.
    if "/" in preset or "\\" in preset or ".." in preset:
        result["reasons"].append(f"invalid rubric_preset name (no path separators allowed): {preset!r}")
        print(json.dumps(result))
        return 1

    preset_path = os.path.join(args.rubrics_dir, "composition-presets", f"{preset}.md")
    if not os.path.isfile(preset_path):
        result["reasons"].append(f"rubric preset not found: {preset_path}")
        print(json.dumps(result))
        return 1

    weights = parse_preset(preset_path)
    if not weights:
        result["reasons"].append(f"preset {preset} declares no rubric weights")
        print(json.dumps(result))
        return 1

    verdict_rubrics = parse_verdict_rubrics(text)
    seen = {}
    duplicates = []
    for name, v in verdict_rubrics:
        if name in seen:
            duplicates.append(name)
        seen[name] = v

    preset_names = set(weights)
    verdict_names = set(seen)
    missing = sorted(preset_names - verdict_names)
    extra = sorted(verdict_names - preset_names)

    # ---- coverage: every preset rubric present exactly once ----
    if missing:
        result["reasons"].append(f"missing rubric section(s) for: {', '.join(missing)}")
    if extra:
        result["reasons"].append(f"verdict scores rubric(s) not in preset '{preset}': {', '.join(extra)}")
    if duplicates:
        result["reasons"].append(f"duplicate rubric section(s): {', '.join(sorted(set(duplicates)))}")

    # ---- recompute (only meaningful once coverage is right, but compute anyway for the report) ----
    recomputed = 0.0
    hard_fail = False
    for name, weight in weights.items():
        v = seen.get(name)
        if v is None:
            continue
        recomputed += weight * VALUE.get(v, 0.0)
        threshold = rubric_threshold(args.rubrics_dir, name)
        if ORDER.get(v, 0) >= ORDER.get(threshold, 2):
            hard_fail = True
    recomputed = round(recomputed, 2)

    expected_overall = "FAIL" if hard_fail else ("PASS" if recomputed >= PASS_THRESHOLD else ("WARN" if recomputed >= WARN_THRESHOLD else "FAIL"))

    result.update({
        "preset": preset,
        "recomputed_score": recomputed,
        "declared_score": declared_score_raw,
        "expected_overall": expected_overall,
        "declared_overall": declared_overall,
        "hard_fail_triggered": hard_fail,
    })

    # ---- consistency checks (only when coverage is clean — a wrong rubric set already fails) ----
    if not (missing or extra or duplicates):
        try:
            declared_score = float(declared_score_raw)
            if abs(declared_score - recomputed) > SCORE_TOLERANCE:
                result["reasons"].append(
                    f"weighted_score mismatch: declared {declared_score}, recomputed {recomputed} (tolerance {SCORE_TOLERANCE})"
                )
        except (TypeError, ValueError):
            result["reasons"].append(f"weighted_score is not a number: {declared_score_raw!r}")

        if declared_overall != expected_overall:
            result["reasons"].append(
                f"overall mismatch: declared {declared_overall}, expected {expected_overall} "
                f"(score {recomputed}, hard_fail {hard_fail})"
            )
        if hard_fail and declared_hf_raw not in ("true", "1", "yes"):
            result["reasons"].append("a hard-fail rubric triggered but hard_fail_triggered is not true")

    result["ok"] = len(result["reasons"]) == 0
    print(json.dumps(result))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
