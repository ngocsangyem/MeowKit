# Red Team System

MeowKit's red-team system is integrated into `mk:review` (v1.2.0). It enhances code review with scope-aware dispatch, adversarial persona passes, forced-finding protocol, and 4-level artifact verification.

## How It Works

```
Diff → Scope Gate ─── minimal ──→ Blind Hunter only ──→ Triage ──→ Verdict
                  └── full ──→ Phase A: 3 Base Reviewers (parallel)
                                  ├─ Blind Hunter
                                  ├─ Edge Case Hunter
                                  └─ Criteria Auditor
                                       │
                                       ↓ findings summary
                                Phase B: Adversarial Personas (2-at-a-time)
                                  ├─ Security Adversary + Failure Mode Analyst
                                  └─ Assumption Destroyer + Scope Critic (high domain only)
                                       │
                                       ↓ merged findings
                                Forced-Finding Check (zero → re-analyze once)
                                       │
                                       ↓
                                Artifact Verification (4-level)
                                       │
                                       ↓
                                Verdict (PASS / WARN / FAIL)
```

## Components

| Component | Role | Where |
|-----------|------|-------|
| `mk:review` | Execution engine (step-file workflow) | `.claude/skills/review/` |
| Scope Gate | Classifies diff as minimal/full | `step-01-gather-context.md` |
| Base Reviewers | 3 parallel layers (Blind/Edge-Case/Criteria) | `step-02-parallel-review.md` |
| Adversarial Personas | 4 hostile lenses, findings-informed | `step-02b-persona-passes.md` |
| Forced-Finding | Zero-finding re-analysis | `step-03-triage.md` |
| Artifact Verification | 4-level implementation checks | `step-04-verdict.md` |
| Security Agent | BLOCK verdicts on critical vulns | `.claude/agents/security.md` |
| Reviewer Agent | 5-dimension framework + Gate 2 | `.claude/agents/reviewer.md` |

## Scope Gate

Determines review intensity based on diff characteristics.

| Signal | Threshold | Effect |
|--------|-----------|--------|
| File count | ≤ 3 | Contributes to minimal scope |
| Line count | ≤ 50 | Contributes to minimal scope |
| Security file touched | Any | Forces full scope |
| Domain complexity | high (via `mk:scale-routing`) | Forces full scope |

All 4 conditions must be below threshold for minimal scope. Any one above → full scope.

## Adversarial Personas

Phase B runs AFTER base reviewers (Phase A). Personas receive the diff AND Phase A findings — so they go deeper, not wider.

| Persona | Lens | Activates When |
|---------|------|---------------|
| Security Adversary | Attack surface, injection, auth bypass | `scope=full` |
| Failure Mode Analyst | Race conditions, cascading failures | `scope=full` |
| Assumption Destroyer | Implicit assumptions, edge cases | `scope=full, domain=high` |
| Scope Complexity Critic | Over-engineering, YAGNI violations | `scope=full, domain=high` |

Personas run 2-at-a-time (max-3-agent rule compliant).

## Artifact Verification

4-level checks in the verdict step catch hollow implementations.

| Level | What | Severity |
|-------|------|----------|
| 1. Exists | Files compile, exports valid | WARN |
| 2. Substantive | No stubs, no TODOs, no empty handlers | WARN/MAJOR |
| 3. Wired | New exports imported by at least one consumer | WARN |
| 4. Data Flowing | Inputs used, returns consumed (heuristic) | MINOR (informational) |

## Forced-Finding Protocol

If all reviewers + personas produce zero findings:
1. Re-run highest-signal reviewer with "look harder" prompt
2. If still zero → accept as clean with note: `"Zero-finding review (double-checked)"`
3. Maximum 1 re-analysis (no infinite loops)

## Configuration

- Scope gate thresholds: constants in `step-01-gather-context.md` (`SCOPE_GATE_MAX_FILES`, `SCOPE_GATE_MAX_LINES`)
- Domain complexity: extend `mk:scale-routing/data/domain-complexity.csv` for project-specific domains
- Persona prompts: edit `prompts/personas/*.md` to tune adversarial intensity

## Sources

Adapted from comparative analysis of 6 external frameworks:
- **ClaudeKit-Engineer** — 4-persona parallel reviewers (adapted as hybrid Phase A+B)
- **BMAD-METHOD** — forced problem-finding (adopted as zero-finding protocol)
- **Get-Shit-Done** — 4-level artifact verification (adapted as verdict checklist)
- **gstack** — scope gate for review activation (adopted with scale-routing integration)
