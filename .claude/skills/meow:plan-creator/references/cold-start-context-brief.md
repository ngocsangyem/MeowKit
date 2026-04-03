# Cold-Start Context Brief

Every phase file must be self-contained. Agent sessions reset. Context windows expire. A phase file that says "see phase-02 for context" is broken by design.

## Why This Matters

When an agent loads a phase file in a new session, it has zero memory of prior conversations, prior decisions, or prior output. If the phase file references other files for context, the agent must either read all of them (slow, expensive) or proceed without context (dangerous).

Self-contained phase files eliminate this problem entirely. Each file carries exactly the context needed to execute that phase, nothing more, nothing less.

## Phase File Template

Every phase file MUST include all 7 sections. No section may reference another file for its content.

```markdown
## Goal
[One sentence. Outcome-focused. "Users can reset their password via email" not "Implement password reset".]

## Context
[What exists now — stated explicitly, not referenced.
Describe the current system state: what files exist, what they do,
what's working, what's missing. Write as if the reader has never seen the codebase.]

## Files to Modify
[Exact paths. One per line. No globs.]

## Files to Read for Context
[Exact paths. One per line. The agent reads these before starting work.]

## Acceptance Criteria
[Binary pass/fail only. Each criterion must be verifiable with a command or file check.
BAD: "code is clean"
GOOD: "npx tsc --noEmit exits 0"]

## Verification Commands
[Runnable commands. Copy-paste ready. No placeholders.
These are what the agent runs to verify AC are met.]

## Exit Criteria
[What state the system must be in before this phase is considered complete.
Includes: all ACs green, all tests passing, no regressions, specific artifact exists at path.]
```

## Anti-Patterns

| Bad | Why It Fails | Fix |
|---|---|---|
| "See phase-02 for context" | Cold-start agent can't load prior phase | Inline the relevant context |
| "Continue from where we left off" | No prior context exists | Describe current state explicitly |
| "The goal is obvious from the task name" | Goals must be stated, not inferred | Write the one-sentence goal |
| ACs like "works correctly" | Cannot be verified mechanically | Rewrite as command + expected output |
| "Run the test suite" with no path | Agent doesn't know which suite | Specify: `npm run test:unit` or `jest src/auth/` |

## Self-Containment Test

Before finalizing a phase file, apply this test: Give the file to a fresh agent with zero prior context. Can it execute the phase without reading any other file? If the answer is no, the file is not self-contained.

Required for pass: the agent can identify the goal, understand the current state, know which files to touch, know what done looks like, and verify completion — all from this file alone.
