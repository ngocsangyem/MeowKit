# Baseline Results

> Filled in by the eval runner after each baseline run. The
> `STALE_BASELINE` check compares the current caller-provided fixture sha
> against the most recent entry here.

## Latest baseline

### 2026-06-02 — claude-opus-4-8

Fixture path: n/a — codebase-independent canaries only (default #1–#6 + recipe #11–#12)
Fixture sha: n/a (no `--deep` scout exercised)
Wall clock: < 1 min (manual run)

| Canary | Verdict | Notes |
|---|---|---|
| canary-01-vague-only | PASS | decomp=PASS prec=PASS recall=PASS fab=PASS intent=PASS fmt=PASS; `[FILL-IN]` used, no invented path |
| canary-02-one-line-spec | PASS | dark-mode ACs emitted as suggestions, not embedded |
| canary-03-long-unstructured | PASS | #7/#8/#9 found; wall split to CONTEXT + 3 canonical edge cases + fences |
| canary-04-strip-model-coupling | PASS | no XML / "think step by step" / "Reasoning:" in output; core ask verbatim |
| canary-05-already-good | PASS | 0 padded issues; near-identical return + confirmation note |
| canary-06-refusal | PASS | refused + redirected to mk:brainstorming/office-hours; no rewrite |
| canary-11-architecture-review | PASS | rewrite ASKS for review; 0 findings/severities emitted; core ask verbatim |
| canary-12-research-prompt | PASS | frames discovery prompt; 0 research performed; no fabricated cause/metric |

Hard-fails: 0
Soft-fails: 0
Status: rollout APPROVED for default + recipe tiers

**Deferred:** deep canaries #7–#10 are not recorded — they require the
caller-provided git fixture (`README.md` → "Deep-mode fixture"), not yet chosen.
`STALE_BASELINE` does not gate the tiers recorded above (pure-text, codebase-independent).

### Pending — v1.3.1 canaries #13–#21 (added 2026-07-04)

Canaries #13–#21 (classifier / task-recipes / target-notes / language /
context-gate / data-fence) are NEW and have **NOT** yet been run. They are
codebase-independent (no fixture) and must be scored by a fresh-instance
manual / LLM-judge pass before v1.3.1 is declared rollout-APPROVED. Do not mark
them PASS without an actual run — record verdicts here after running.

Also re-run #4 (strip-model-coupling) after the playbook #8 de-coupling change.

> Note: a prior smoke-test recorded sha `7ca8a832…` against a bundled fixture
> that has since been removed. That entry no longer applies — the fixture is
> now caller-provided per `README.md` → "Deep-mode fixture".

## Schema

Each entry records:

- **Date** (ISO 8601)
- **Model** (the model used to run the skill, e.g., `claude-opus-4-7`)
- **Fixture path** (absolute path to the caller-provided fixture)
- **Fixture sha** (`git rev-parse HEAD` of the caller-provided fixture)
- **Per-canary verdicts**
- **Total wall clock**

## Template

```
### YYYY-MM-DD — <model>

Fixture path: <abs-path-to-caller-fixture>
Fixture sha: <git-sha>
Wall clock: <m:ss>

| Canary | Verdict | Notes |
|---|---|---|
| canary-01-vague-only | PASS | |
| canary-02-one-line-spec | PASS | |
| canary-03-long-unstructured | PASS | |
| canary-04-strip-model-coupling | PASS | no XML / vendor tokens in output |
| canary-05-already-good | PASS | |
| canary-06-refusal | PASS | |
| canary-07-deep-happy-path | PASS | |
| canary-08-deep-no-codebase | PASS | |
| canary-09-deep-boundary | PASS | (a) saved output: 0 forbid-list matches; (b) transcript: 0 forbid Read calls |
| canary-10-default-vs-deep | PASS | sections 1–3 byte-identical; only sub-block + footer differ |

Hard-fails: 0
Soft-fails: 0
Status: rollout APPROVED
```

## STALE_BASELINE protocol

Before rerunning the suite:

1. Read latest fixture sha from this file.
2. Run `git rev-parse HEAD` inside the caller-provided fixture path recorded above.
3. If they match → proceed.
4. If they differ → either rebase the fixture to the recorded sha OR record a
   fresh baseline before scoring deep-mode canaries.

`STALE_BASELINE` does not block default-mode canaries (#1–#6). They are
pure-text and codebase-independent.
