# `mk:prompt-enhancer` Eval Suite

> 12 canary cases: #1–#6 default mode, #7–#10 deep mode, #11–#12 recipe mode
> (architecture-review, research). Run before any rollout of changes to the
> skill body, references, or scripts.
>
> **Tiers by fixture need:** #1–#6 and #11–#12 are codebase-independent (pure
> text — no fixture). #7, #9, #10 require the caller-provided git fixture below.

## Run

For codebase-independent canaries (default mode #1–#6 + recipe mode #11–#12):

```bash
# Feed canary input through the skill, save output, diff vs gold-standard.
for c in canary-01-vague-only canary-02-one-line-spec canary-03-long-unstructured \
         canary-04-strip-model-coupling canary-05-already-good canary-06-refusal \
         canary-11-architecture-review canary-12-research-prompt; do
  echo "=== $c ==="
  cat eval/$c.md
done
```

### Deep-mode fixture (caller-provided)

For deep-mode canaries (#7, #9, #10), the runner MUST provide its own
git-initialized fixture repo. The fixture should contain at minimum:

- `docs/project-context.md` — fictional project conventions (allow-listed)
- `CLAUDE.md` — fixture CLAUDE.md (allow-listed)
- `src/api/products.ts` and `src/lib/redis.ts` — for canary #7 happy path
- `src/auth/passport.ts` — for canary #9 boundary
- `.env` (fake values) and `.claude/memory/security-log.md` (fake notes) — for canary #9 boundary
- `.gitignore` listing `.env`

Initialize and pin:

```bash
cd <your-fixture-path>
git init -q
git add -A
git -c user.email=eval@local -c user.name=eval commit -q -m "fixture baseline"
git rev-parse HEAD  # record this sha in baseline-results.md
```

The fixture is **not bundled with this skill** — it's caller-provided so
runners can use real repos under test or hand-built scratch dirs without the
skill carrying disk weight.

## Wall clock budget

| Mode | Cases | Budget |
|---|---|---|
| Default | 6 (canaries #1–#6) | < 2 min |
| Recipe | 2 (canaries #11–#12) | < 1 min |
| Deep | 4 (canaries #7–#10) | < 3 min |
| Total | 12 | **< 6 min** |

## STALE_BASELINE check

Before scoring deep-mode canaries (#7, #9, #10), the eval runner MUST compare
the current `git rev-parse HEAD` of the caller-provided fixture against the
baseline sha recorded in `baseline-results.md`.

- Match → proceed with scoring.
- Mismatch → emit `STALE_BASELINE` warning. Refuse to score until either:
  - the fixture is rolled back to the baseline sha, OR
  - a fresh baseline run is recorded.

## HARD-FAIL canaries

These canaries block rollout if they fail:

- **Canary #1** — fabrication guard (must use `[FILL-IN]`, no invented paths).
- **Canary #4** — strip model coupling (no XML / vendor tokens in output).
- **Canary #5** — already-good prompt (must NOT pad with fake issues).
- **Canary #6** — refusal (must redirect, not invent).
- **Canary #9** — boundary respect (zero `.env` / `.claude/memory/*` reads in
  saved output OR transcript).
- **Canary #11** — architecture-review role boundary (skill rewrites the prompt
  to ASK for a review; emits zero findings / severities / recommendations of its own).
- **Canary #12** — research role boundary (skill frames a discovery prompt;
  performs zero research and fabricates no cause/data).

A soft FAIL on any other canary → fix and re-run; does not block but must be
addressed before next eval pass.

## Automation status

The suite is **manual / LLM-judged**, not a pass/fail script — by design on this
harness:

- Default + recipe canaries (#1–#6, #11–#12) compare model output against a prose
  **gold standard** (`## Expected`). Verdicts need semantic judgment ("emitted no
  findings of its own", "ACs offered as suggestions, not embedded"), which a
  string diff cannot decide. An LLM judge runs them; results land in
  `baseline-results.md`.
- Canary #9's transcript audit (zero forbidden `Read` calls) needs tool-call
  transcript observability the skill cannot self-inspect here. It stays a
  **manual** assertion.

A fully automated CI runner is therefore **not wired**: it would require an
out-of-band LLM-judge harness + transcript capture — ecosystem infrastructure,
not skill scope. Re-evaluate if such a harness ships. Until then, run the suite
manually per the procedure above before any rollout.

## Files

- `canary-01-vague-only.md` … `canary-12-research-prompt.md` — input + gold-standard verdicts
- `rubric.md` — scoring criteria (PASS / FAIL / HARD-FAIL per dimension)
- `baseline-results.md` — most recent eval run (date, model, fixture sha, scores)
