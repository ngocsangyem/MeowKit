# Config Contract, Metric Library & Noise

## Contents

- Config fields (required / optional)
- Batched AskUserQuestion (missing required fields)
- Metric / Verify pattern library
- Noise handling & Min-Delta
- Back to [`loop-protocol.md`](loop-protocol.md)

---

## Config Fields

Parsed from the user message at Stage 0.

### Required

| Field | Description | Example |
| --- | --- | --- |
| `Goal` | Human description of what to improve | `Increase test coverage in src/utils` |
| `Scope` | Glob(s) for editable files | `src/utils/**/*.ts, tests/utils/**/*.test.ts` |
| `Metric` | Name + unit | `line coverage %` |
| `Direction` | `higher` or `lower` is better | `higher` |
| `Verify` | Shell command that prints **a single number** to stdout | see library below |

### Optional

| Field | Default | Description |
| --- | --- | --- |
| `Guard` | none | Regression check command; exit 0 = pass |
| `Iterations` | **10** | Hard cap before Gate B |
| `Noise` | `medium` | Metric variance: `low` / `medium` / `high` |
| `Min-Delta` | derived from Noise | Minimum improvement to count as progress |
| `Stop-At` | none | Target value; crossing it ends the loop early |

**Why Iterations defaults to 10 (not 25):** MeowKit favors bounded autonomy with a human
re-gate. A low cap reaches Gate B sooner so the user re-confirms intent before more spend;
the user can approve more at the gate. Larger upstream defaults assume unattended runs,
which the boundary-gated model deliberately rejects.

---

## Batched Question (missing required fields)

Ask ALL missing required fields in one `AskUserQuestion`; run nothing until answered.

```
AskUserQuestion({
  questions: [
    { question: "What metric do you want to improve? (e.g. 'line coverage in src/utils')",
      header: "Goal" },
    { question: "Which files may be edited? (globs, e.g. 'src/utils/**/*.ts')",
      header: "Scope" },
    { question: "Verify command — must print a single number to stdout. Is higher or lower better?",
      header: "Verify+Direction" },
    { question: "Regression guard command? (optional; exit 0 = pass; Enter to skip)",
      header: "Guard" }
  ]
})
```

---

## Metric / Verify Pattern Library

Each entry: a Verify one-liner (prints one number) + Direction + suggested Noise + a Guard
idea. Wrap any command in `| tail -1` if it can emit extra lines.

### Test coverage (Direction: higher · Noise: low)

```bash
# Node.js — Jest
npx jest --coverage --coverageReporters=json-summary 2>/dev/null \
  | node -e "const s=require('./coverage/coverage-summary.json');console.log(s.total.lines.pct)"
# Python — pytest-cov
pytest --cov=src --cov-report=term -q 2>/dev/null | grep TOTAL | awk '{print $NF}' | tr -d '%'
# Go
go test ./... -coverprofile=cover.out 2>/dev/null && go tool cover -func=cover.out \
  | grep total | awk '{print $3}' | tr -d '%'
```
Guard idea: the project test suite (`npm test` / `pytest` / `go test ./...`).

### Lint / type errors (Direction: lower · Noise: low)

```bash
# ESLint error count
npx eslint src --format json 2>/dev/null \
  | node -e "const r=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(r.reduce((a,f)=>a+f.errorCount,0))"
# tsc type errors
npx tsc --noEmit 2>&1 | grep -c 'error TS' || true
```
Guard idea: `npm test`.

### Bundle / binary size, bytes (Direction: lower · Noise: low)

```bash
npm run build 2>/dev/null && find dist -name '*.js' ! -name '*.map' | xargs wc -c | tail -1 | awk '{print $1}'
go build -o /tmp/app_m . 2>/dev/null && wc -c < /tmp/app_m
```
Guard idea: `tsc --noEmit` + a smoke test.

### Benchmark / latency, ms (Direction: lower · Noise: high)

```bash
curl -o /dev/null -s -w "%{time_total}" http://localhost:3000/api/health | awk '{printf "%.0f\n",$1*1000}'
```
Guard idea: the project test suite. Warn the user if Verify exceeds ~30s under high noise.

### Creating a custom metric

1. Measure exactly one numeric value. 2. Print it as the last stdout line. 3. Exit 0 on
success (non-zero is treated as a crash). 4. Finish in < 30s. 5. Keep units constant across
the whole run. 6. If output varies run-to-run, set `Noise: high`.

---

## Noise Handling & Min-Delta

| Noise | Verify runs per iteration | Value used | Default Min-Delta |
| --- | --- | --- | --- |
| `low` | 1 | the single result | 0 (any improvement counts) |
| `medium` | 2 | the **worse** of the two | small ε (~1–2% of baseline) |
| `high` | 3 | the **median** | larger ε (~3–5% of baseline) |

- Use the worse-of / median rule so measurement variance does not produce a false keep.
- Plateau detection (loop-protocol.md) counts only *keeps that improved > Min-Delta*, so a
  noisy metric does not trigger a false plateau.
- Warn if Verify takes > 30s and Noise is `high` (3 runs → >90s per iteration is impractical).
- Environment pinning is the user's responsibility (fixed seeds, warm/cold caches consistent,
  no competing CPU load, same input data). `mk:loop` cannot control the environment.
