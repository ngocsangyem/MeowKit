# Gotchas

Update when Claude hits new brainstorming edge cases.

- **Premature solutioning**: jumping to "how" before understanding "what" → force problem restatement first; do not generate ideas until problem is confirmed via AskUserQuestion
- **Anchoring on first idea**: first idea gets disproportionate attention in evaluation → generate ALL ideas before scoring any; use scoring-criteria.md only after full list is complete
- **Confusing brainstorming with planning**: producing implementation steps, file paths, or commands instead of ideas → hard gate: no code, no file creation, no implementation details in output
- **Context flooding**: generating 20+ ideas overwhelms context window → max 8 ideas per run; if problem needs more, run multiple focused sessions on sub-problems
- **Overlapping with office-hours**: using brainstorming when problem isn't validated yet → if user hasn't confirmed "this is worth building", redirect to meow:office-hours first
- **Scoring bias toward familiar solutions**: known patterns score high on feasibility, novel approaches get dismissed → score novelty as separate criterion; flag when all top picks are conservative
