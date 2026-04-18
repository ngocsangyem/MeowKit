# Gotchas

Update when Claude hits new brainstorming edge cases. Highest-signal content in the skill — keep it sharp.

- **Premature solutioning** — jumping to "how" before confirming "what". Force problem restatement first; do not generate ideas until the problem is confirmed via `AskUserQuestion`.
- **Anchoring on first idea** — the first idea gets disproportionate attention in evaluation. Generate ALL ideas before scoring any; use `scoring-criteria.md` only after the full list is complete.
- **Confusing brainstorming with planning** — producing implementation steps, file paths, or commands instead of ideas. Hard gate: no code, no file creation outside `plans/reports/`, no implementation details.
- **Context flooding** — generating 20+ ideas overwhelms context window. Max 8 ideas per run. If the problem needs more, run multiple focused sessions on sub-problems.
- **Overlapping with office-hours** — using brainstorming when the problem isn't validated yet. If the user hasn't confirmed "this is worth building", redirect to `meow:office-hours` first.
- **Scoring bias toward familiar solutions** — known patterns score high on feasibility, novel approaches get dismissed. Score novelty as a separate criterion; flag when all top picks are conservative.
- **Scope explosion mid-session** — user keeps adding requirements during ideation. If scope grows past the original ask, STOP and decompose into sub-projects. Each sub-project gets its own brainstorm.
- **Question fatigue** — asking 5+ clarifying questions before generating any ideas. Cap discovery at 3 questions per batch, then ideate even if some ambiguity remains.
- **Technique mismatch** — wrong technique for the problem (e.g., `first-principles.md` on a well-known pattern). If a technique produces weak ideas after 3 attempts, switch techniques rather than forcing more ideas.
- **Semantic clustering** — all ideas are variations of the same underlying mechanism (e.g., WebSocket / Socket.IO / ws library). Apply anti-bias pivot: force one orthogonal category before closing.
- **User pre-decided** — user already has a preferred answer and steers every question back to it. Name it: "It sounds like you've decided on X. Want me to stress-test X instead?" Switch to `reverse.md`.
- **Empty intersection** — `constraint-mapping.md` produces no solution satisfying all hard constraints. Do NOT fabricate a solution that fudges a hard constraint. Report back to the user: "Constraints A and B cannot both be satisfied."
