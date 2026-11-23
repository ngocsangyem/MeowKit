#!/usr/bin/env python3
"""Turn `mewkit eval run` reports into per-family verdicts with intervals.

Usage:
  analyze-eval-reports.py REPORT.json                 # skill lift (on vs off) in one report
  analyze-eval-reports.py BASE.json NEW.json          # kit A vs kit B, same model and cases

Paired cases are grouped into families by id: `<skill>-g-<n>` is guidance (a weaker
model losing an instruction it needed), `<skill>-r-<n>` is restraint (a stronger model
over-applying one). The unit of analysis is the case, because runs inside one case are
correlated: each case scores the mean pass rate of its runs, differences are taken per
case, and the interval comes from resampling cases (seeded bootstrap, 2 000 draws).

Verdict per family: regression when the whole 95 % interval of the mean per-case
difference lies below -5 points, improvement when above +5, otherwise inconclusive.
"provisional" marks a family with fewer than 10 cases or an interval wider than 20
points; "resolution-limited" marks five or fewer cases that flip between majority-pass
and majority-fail. These thresholds are conventions, not a power analysis.

Python standard library only; nothing is written.
"""

import json
import math
import random
import re
import sys

THRESHOLD = 0.05
DRAWS = 2000
MIN_CASES = 10
MAX_WIDTH = 0.20
FAMILY = re.compile(r"-(g|r)-\d+$")
NAMES = {"g": "guidance", "r": "restraint"}


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def family(case_id):
    m = FAMILY.search(case_id)
    return NAMES[m.group(1)] if m else "other"


def paired_rates(case):
    """(on, off, n) over complete pairs, as the runner counts them (rates.rs)."""
    on = [r["outcome"] for r in case["runs"] if r.get("arm") == "on"]
    off = [r["outcome"] for r in case["runs"] if r.get("arm") == "off"]
    pairs = [(a, b) for a, b in zip(on, off) if a != "error" and b != "error"]
    if not pairs:
        return None
    n = len(pairs)
    return (
        sum(a == "pass" for a, _ in pairs) / n,
        sum(b == "pass" for _, b in pairs) / n,
        n,
    )


def scores(report):
    """case id -> (family, on, off, n, heldOut) for every paired case with data."""
    out = {}
    for c in report["cases"]:
        if c.get("kind") != "paired":
            continue
        r = paired_rates(c)
        if r:
            out[c["id"]] = (family(c["id"]), *r, bool(c.get("heldOut")))
    return out


def wilson(passes, n, z=1.96):
    if n == 0:
        return (float("nan"),) * 2
    p = passes / n
    d = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / d
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return centre - half, centre + half


def bootstrap(diffs):
    rng = random.Random(0)
    k = len(diffs)
    means = sorted(sum(rng.choice(diffs) for _ in range(k)) / k for _ in range(DRAWS))
    return means[int(0.025 * DRAWS)], means[int(0.975 * DRAWS) - 1]


def mcnemar(pairs):
    """Exact two-sided McNemar on majority-pass flips; returns (discordant, p)."""
    b = sum(x > 0.5 >= y for x, y in pairs)
    c = sum(y > 0.5 >= x for x, y in pairs)
    n = b + c
    if n == 0:
        return 0, 1.0
    tail = sum(math.comb(n, i) for i in range(min(b, c) + 1)) / 2**n
    return n, min(1.0, 2 * tail)


def verdict(lo, hi, k, discordant):
    if hi < -THRESHOLD:
        v = "REGRESSION"
    elif lo > THRESHOLD:
        v = "IMPROVEMENT"
    else:
        v = "inconclusive"
    tags = []
    if k < MIN_CASES or hi - lo > MAX_WIDTH:
        tags.append("provisional")
    if discordant <= 5:
        tags.append("resolution-limited")
    return v + (f" ({', '.join(tags)})" if tags else "")


def pct(x):
    return f"{x * 100:5.1f}"


def compare_rows(label, pairs):
    """pairs: list of (a, b) case scores; difference is b - a."""
    k = len(pairs)
    if k == 0:
        return
    diffs = [b - a for a, b in pairs]
    mean = sum(diffs) / k
    lo, hi = bootstrap(diffs) if k > 1 else (mean, mean)
    disc, p = mcnemar(pairs)
    print(
        f"  {label:<22} cases {k:>3}  {pct(sum(a for a, _ in pairs) / k)} -> {pct(sum(b for _, b in pairs) / k)}"
        f"  diff {mean * 100:+5.1f} [{lo * 100:+5.1f}, {hi * 100:+5.1f}]  flips {disc} p={p:.3f}  {verdict(lo, hi, k, disc)}"
    )


def pooled(report_scores, fam, arm):
    """Wilson interval over all runs of one arm in one family, for reading only."""
    rows = [s for s in report_scores.values() if s[0] == fam]
    n = sum(s[3] for s in rows)
    passes = sum(round(s[1 if arm == "on" else 2] * s[3]) for s in rows)
    lo, hi = wilson(passes, n)
    return f"{pct(passes / n) if n else '  n/a'} [{pct(lo)}, {pct(hi)}] over {n} runs"


def lift(report, title):
    s = scores(report)
    print(f"\n{title}: model {report.get('model')}, complete {report.get('complete')}")
    for fam in ("guidance", "restraint", "other"):
        rows = [v for v in s.values() if v[0] == fam]
        if not rows:
            continue
        print(f"  {fam}: on {pooled(s, fam, 'on')}; off {pooled(s, fam, 'off')}")
        compare_rows(f"{fam} lift (off->on)", [(v[2], v[1]) for v in rows])
    flat = [cid for cid, v in s.items() if (v[1] >= 0.9 and v[2] >= 0.9) or (v[1] <= 0.1 and v[2] <= 0.1)]
    if flat:
        print(f"  non-discriminating here (on and off both >=90% or both <=10%): {', '.join(sorted(flat))}")
    never = [c["id"] for c in report["cases"] if c.get("kind") == "paired" and not paired_rates(c)]
    if never:
        print(f"  no complete pairs (all errored): {', '.join(never)}")


def main(argv):
    if len(argv) not in (2, 3):
        print(__doc__)
        return 2
    reports = [load(p) for p in argv[1:]]
    if len(reports) == 1:
        lift(reports[0], "Report")
        return 0
    base, new = reports
    for key in ("model", "runtime", "caseSetHash"):
        if base.get(key) != new.get(key):
            print(f"Not comparable: {key} differs ({base.get(key)} vs {new.get(key)})")
            return 1
    for r, name in ((base, "base"), (new, "new")):
        if not r.get("complete"):
            print(f"warning: the {name} report is incomplete; results below are partial")
    lift(base, "Base kit")
    lift(new, "New kit")
    sb, sn = scores(base), scores(new)
    shared = sorted(set(sb) & set(sn))
    print(f"\nBase kit -> new kit, skill on (model {base.get('model')}):")
    for fam in ("guidance", "restraint", "other"):
        compare_rows(fam, [(sb[c][1], sn[c][1]) for c in shared if sb[c][0] == fam])
    held = [c for c in shared if sb[c][4]]
    compare_rows("held-out only", [(sb[c][1], sn[c][1]) for c in held])
    moved = [
        f"{c} {pct(sb[c][1])}->{pct(sn[c][1])}"
        for c in shared
        if abs(sn[c][1] - sb[c][1]) >= 0.6
    ]
    if moved:
        print("  cases that moved 60+ points (look at their transcripts): " + "; ".join(moved))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
