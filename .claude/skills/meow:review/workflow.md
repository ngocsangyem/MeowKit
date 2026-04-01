# Adversarial Code Review — Workflow

Scope-aware parallel review with adversarial persona passes, forced-finding, and triage.

## Rules

- NEVER load multiple step files simultaneously
- ALWAYS read entire step file before execution
- NEVER skip steps or optimize the sequence
- ALWAYS halt at triage and wait for human input on FAIL findings

## Steps

1. `step-01-gather-context.md` — Load diff, plan, acceptance criteria. **Assess review scope** (minimal/full) and domain complexity.
2. `step-02-parallel-review.md` — **Phase A:** Dispatch reviewers based on scope. Minimal=Blind Hunter only. Full=all 3 reviewers.
3. `step-02b-persona-passes.md` — **Phase B** (full scope only): Dispatch adversarial persona subagents informed by Phase A findings. Skip if scope=minimal.
4. `step-03-triage.md` — **Forced-finding check** (zero findings = re-analyze once). Then categorize as current-change or incidental. Dedup Phase A + Phase B.
5. `step-04-verdict.md` — Synthesize verdict + **artifact verification** (full scope: 4-level checks for stubs, orphans, data flow). Present to human for Gate 2.

## Variables Passed Between Steps

| Variable | Set by | Used by | Values |
|----------|--------|---------|--------|
| `review_scope` | step-01 | step-02, step-02b, step-03 | `minimal` or `full` |
| `domain_complexity` | step-01 | step-02b | `low`, `medium`, `high`, or `unknown` |
| `base_findings_summary` | step-02 | step-02b | Condensed Phase A findings (one line per finding) |
| `phase_b_findings` | step-02b | step-03 | Persona findings tagged with `[Phase B: persona-name]` |

## Flow

```
Gather Context ──→ Scope Assessment
                      │
                      ├─ minimal ──→ Blind Hunter only ──→ Triage ──→ Verdict
                      │
                      └─ full ──→ Phase A: Fan Out 3 Reviewers
                                    ├─ Blind Hunter
                                    ├─ Edge Case Hunter
                                    └─ Criteria Auditor
                                         │
                                         ↓ base_findings_summary
                                  Phase B: Persona Passes (2-at-a-time)
                                    ├─ Security Adversary + Failure Mode Analyst
                                    └─ Assumption Destroyer + Scope Critic (high domain only)
                                         │
                                         ↓ merged findings
                                  Forced-Finding Check ──→ Triage ──→ Verdict
```

## Next

Read and follow `step-01-gather-context.md`
