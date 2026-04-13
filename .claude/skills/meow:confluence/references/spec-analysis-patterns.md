# Spec Analysis Patterns

Heuristics for extracting requirements, detecting gaps, and flagging ambiguities.

## Requirement Classification

| Pattern | Classification | Confidence |
|---------|---------------|------------|
| "must", "shall", "required", "will" | Functional requirement | High |
| "should", "ideally", "nice to have", "optional" | Optional requirement | High |
| "must not", "cannot", "prohibited", "never" | Constraint | High |
| "given/when/then", "verify that", "acceptance criteria" | Acceptance criteria | High |
| "assume", "assuming", "we expect" | Assumption | Medium |

## Gap Detection

| Check | Tag | When to flag |
|-------|-----|-------------|
| No AC section | `[MISSING] Acceptance criteria` | No "acceptance criteria", "given/when/then", or testable outcomes found |
| No error handling | `[MISSING] Error handling` | No mention of errors, failures, edge cases, timeouts |
| No security section | `[MISSING] Security considerations` | No mention of auth, permissions, data protection |
| No performance criteria | `[MISSING] Performance requirements` | No latency, throughput, or capacity targets |

## Weasel Word Detection

Flag these when used WITHOUT measurable criteria:

| Word | Why it's vague | What to flag |
|------|---------------|-------------|
| "fast" | No latency target | `[VAGUE] "fast" — no p99/p95 target` |
| "scalable" | No capacity target | `[VAGUE] "scalable" — no concurrency/load target` |
| "improve" | No baseline or delta | `[VAGUE] "improve" — no baseline or % improvement target` |
| "better" | Compared to what? | `[VAGUE] "better" — no comparison baseline` |
| "flexible" | No extensibility criteria | `[VAGUE] "flexible" — no specific extension points` |
| "might", "possibly", "maybe" | Uncertain scope | `[AMBIGUOUS] Unclear if in scope` |
| "TBD", "to be determined" | Deferred decision | `[AMBIGUOUS] Decision pending — blocks implementation` |
| "as needed", "if necessary" | No trigger criteria | `[AMBIGUOUS] No trigger condition defined` |

## Story Size Heuristics

| Signal | Interpretation |
|--------|---------------|
| >3 acceptance criteria | Consider splitting |
| Description >500 words | May be an epic, not a story |
| Mentions >3 components | Cross-cutting — complexity signal: high |
| "phase 1", "phase 2" | Already decomposed — map to stories |
