# Cold-Start Context Brief

Every phase file must be self-contained. Agent sessions reset. Context windows expire. A phase file that says "see phase-02 for context" is broken by design.

## Why This Matters

When an agent loads a phase file in a new session, it has zero memory of prior conversations, prior decisions, or prior output. If the phase file references other files for context, the agent must either read all of them (slow, expensive) or proceed without context (dangerous).

Self-contained phase files eliminate this problem entirely. Each file carries exactly the context needed to execute that phase, nothing more, nothing less.

## What a phase file carries

A phase file follows `phase-template.md` (frontmatter plus 12 sections). Cold-start means those sections state, in the file itself: the outcome, the current state of the system (what exists and what is missing, written for a reader who has never seen the codebase), exact paths to modify and to read, binary acceptance criteria, copy-paste-ready verification commands with no placeholders, and the exit state (artifacts exist, no regressions, and the system is runnable where the phase is a feature slice). A section may point to a research report for background, never for content it needs to execute.

## Anti-Patterns

| Bad | Why It Fails | Fix |
|---|---|---|
| "See phase-02 for context" | Cold-start agent can't load prior phase | Inline the relevant context |
| "Continue from where we left off" | No prior context exists | Describe current state explicitly |
| "The goal is obvious from the task name" | Goals must be stated, not inferred | Write the one-sentence goal |
| ACs like "works correctly" | Cannot be verified mechanically | Rewrite as command + expected output |
| "Run the test suite" with no path | Agent doesn't know which suite | Specify: `npm run test:unit` or `jest src/auth/` |
| No autonomy latitude stated (long-horizon plan) | On a multi-session or autonomous run the executor sees only stop-or-proceed — it over-asks on trivia or over-reaches on significant reversible choices | State the per-task Always / Ask-first latitude as a short delta over the baseline rules (long-horizon plans only) |

## Self-Containment Test

Before finalizing a phase file, apply this test: Give the file to a fresh agent with zero prior context. Can it execute the phase without reading any other file? If the answer is no, the file is not self-contained.

Required for pass: the agent can identify the goal, understand the current state, know which files to touch, know what done looks like, and verify completion — all from this file alone.
