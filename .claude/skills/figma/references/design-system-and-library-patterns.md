# Design-System Rules & Library Patterns (conditional)

> **Load condition — load ONLY on explicit user intent** to generate design-system rules or discuss library-build
> architecture. Output is ADVISORY rule text only. This reference performs NO Figma writes; full library
> execution stays out of scope for `mk:figma`.

## Contents

- [Part A — Design-system rules generation](#part-a--design-system-rules-generation)
- [Part B — Library-build architecture lessons](#part-b--library-build-architecture-lessons)

## Part A — Design-system rules generation

Generate project-specific agent rules from Figma + codebase conventions.

- Analyze the codebase's existing conventions (naming, token usage, component structure) first.
- Generate concise, actionable rule files — describe the convention and the "why", not a tutorial.
- Avoid bloat: one rule per convention; no restating what the model already knows.
- Apply progressive disclosure to the generated rules themselves (overview + linked detail), the same
  way skills are structured.
- Output is rule text for the user to review and adopt — never a Figma write.

## Part B — Library-build architecture lessons

Building or updating a full Figma design-system library is out of scope to execute here (a 20–100+ call workflow). If a user asks for one, these are the load-bearing patterns to advise on:

- **Multi-phase structure:** discovery → foundations → documentation → components → integration/QA.
- **Mandatory human checkpoints** between phases — never a one-shot build.
- **State ledger:** persist what has been created so a run can resume after interruption.
- **Plugin-data tagging:** tag self-created nodes so cleanup targets only verified artifacts.
- **Idempotent check-before-create helpers:** look up by name before creating to avoid duplicates.
- **No one-shot library generation:** the blast radius and long-run recovery needs require checkpoints.
