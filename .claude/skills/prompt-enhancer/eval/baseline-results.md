# Baseline Results

> Filled in by the eval runner after each baseline run. The
> `STALE_BASELINE` check compares the current caller-provided fixture sha
> against the most recent entry here.

## Latest baseline

(Empty — populate on first run with the caller-provided fixture.)

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
