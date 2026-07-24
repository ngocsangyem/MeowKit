# Verification Roles

## Contents

- [Purpose](#purpose)
- [Where it runs](#where-it-runs)
- [Tier selection by phase count](#tier-selection-by-phase-count)
- [Role responsibilities](#role-responsibilities)
- [sub-task dispatch brief](#sub-task-dispatch-brief)
- [Output format (uniform)](#output-format-uniform)
- [Aggregation pattern](#aggregation-pattern)
- [Backward compatibility](#backward-compatibility)

## Purpose

`validate-plan.py` checks structure and frontmatter drift; it does NOT confirm that a cited file path, function name, or contract count actually exists in the codebase. Verification Roles layer on top of that structural check: each role dispatches as one read-only sub-task that verifies claims against the live codebase and returns a uniform verdict list. Failed claims become interview topics in step-06, not auto-rejects — humans adjudicate.

## Where it runs

`step-04-semantic-checks.md` sub-step 4d. Runs AFTER 4a (semantic) and 4b (structural). Skipped if either prior sub-step fails or if `planning_mode = fast | product-level`.

## Tier selection by phase count

| Phase count | Tier | Roles spawned | Claims budget per phase |
|---|---|---|---|
| 1–2 | Light | Fact Checker | 5 |
| 3–4 | Standard | Fact Checker + Contract Verifier | 10 |
| 5+ | Full | Fact Checker + Flow Tracer + Scope Auditor + Contract Verifier | 15 |

Tier auto-selected from `glob(phase-XX-*.md)` count. `verification_tier` is set by step-04 and read by step-06 to generate interview questions from FAILED claims.

## Role responsibilities

| Role | Verifies | Method | Red flag |
|---|---|---|---|
| Fact Checker | File paths, symbols, endpoints, config keys exist | `grep -F`, `glob` | grep returns nothing for cited wrapper/manager names |
| Flow Tracer | Behavioral claims ("X triggers Y", "A calls B before C") | Read claimed entry point → trace call path | "X triggers Y" but X and Y share no call path |
| Scope Auditor | State additions respect lifetime boundaries | Grep all instantiation sites of target | "Add field to X" when X is a singleton |
| Contract Verifier | Interface changes account for ALL consumers | Enumerate ALL callers — explicit count | Plan says "3 callers" but grep finds 7 |

## sub-task dispatch brief

sub-task are READ-ONLY. They do NOT write to phase files. The orchestrator collects verdicts and performs ONE Edit per phase file to write the `## Verification Log` section.

Use `subagent_type=Explore` (read-only). One Agent call per role; all roles dispatched in parallel via a single message.

```
Role: {role-name}
Phase file: {absolute-path}
Tier: {Light|Standard|Full}
Claim budget: {N} claims per phase
Work context: {project-root}

Read the phase file. Extract claims relevant to your role:
- Fact Checker: file paths, symbol names, endpoints, config keys
- Flow Tracer: behavioral assertions ("X triggers Y", call ordering)
- Scope Auditor: state additions, lifetime boundaries, singleton vs per-request
- Contract Verifier: interface changes, function signatures, caller counts

SENSITIVE-FILE EXCLUSIONS (per `injection-rules.md` Rule 4):
DO NOT read: .env, .env.*, *.pem, *.key, *credentials*, *secret*, files
containing API keys / tokens / passwords. If a cited path matches these
patterns, emit `UNVERIFIED (sensitive file excluded)` and stop on that
claim.

STAY WITHIN: {project-root}. Do not read outside the project tree.

For each claim (up to the budget):
  1. Identify the claim.
  2. Verify via Grep / Read (excluding sensitive files above).
  3. Output ONE LINE PER CLAIM in EXACTLY this format:
     VERIFIED (file:line) — <symbol/path>
     FAILED (not found) — <symbol/path>
     UNVERIFIED (<reason>) — <symbol/path>

DO NOT include file contents, code snippets, or any other text. ONLY the
verdict lines. The orchestrator rejects lines that don't match this format.

If Contract Verifier finds > 10 callers, list the first 10 + total count.

Return as a markdown list (one verdict per line).
```

## Output format (uniform)

Three verdicts only:

| Verdict | Meaning | Downstream effect |
|---|---|---|
| `VERIFIED (file:line) — <symbol/path>` | Found via grep/read | none |
| `FAILED (not found) — <symbol/path>` | Cited but absent | step-06 generates targeted question |
| `UNVERIFIED (<reason>) — <symbol/path>` | Ambiguous or sensitive | step-06 generates clarifying question |

The orchestrator silently drops any line that does not match this grammar.

## Aggregation pattern

sub-task run in parallel and return verdict lists. The orchestrator (planner agent) collects all sub-task outputs, validates each line matches the verdict format (drops malformed lines), groups by phase file, and performs ONE single Edit per phase file to write the `## Verification Log` section. This eliminates the parallel-write race that would violate file-ownership rules.

Insertion point: BEFORE the existing `## Next Steps` heading in each phase file. Create `## Verification Log` if missing.

Aggregated block written by the orchestrator:

```markdown
## Verification Log

### Fact Checker — <ISO-8601>
- VERIFIED (src/lib/auth.ts:42) — authMiddleware
- FAILED (not found) — src/utils/auth.ts
- UNVERIFIED (sensitive file excluded) — .env.production

### Contract Verifier — <ISO-8601>
- VERIFIED (src/api/routes.ts:118) — parseConfig() — 3 callers listed below
- VERIFIED (src/api/middleware.ts:45) — caller 1
- VERIFIED (src/api/auth.ts:91) — caller 2
- VERIFIED (tests/api.test.ts:202) — caller 3
```

## Backward compatibility

- `## Verification Log` is OPTIONAL. Legacy plans without it pass `validate-plan.py`.
- Section is machine-written. Humans should not hand-edit — orchestrator overwrites on next run.
- Step-06 reads each phase's `## Verification Log` if present and generates clarifying questions from FAILED / UNVERIFIED entries.

## Sizing

- sub-task brief template: ~0.6KB
- Phase file: ≤200 lines × ~80 char/line ≈ 16KB
- Total per-sub-task working context: ≤20KB (well under the 32KB inner-harness cap)
- Full tier with 7 phases: 4 roles × parallel dispatch — bounded by slowest sub-task, not the sum
