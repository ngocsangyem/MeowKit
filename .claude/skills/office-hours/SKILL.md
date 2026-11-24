---
name: mk:office-hours
preamble-tier: 3
version: 2.0.0
description: "YC-style check an idea is worth building. NOT for mk:plan-ceo-review."
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Write
  - Edit
  - AskUserQuestion
  - WebSearch
source: gstack
keywords:
  - office-hours
  - yc
  - product-validation
  - forcing-questions
  - brainstorm-builder
  - design-doc
when_to_use: "Unproven idea."
user-invocable: true
owner: research
criticality: medium
status: active
runtime: claude-code
---

# Office Hours

Decides whether an idea is worth building and writes a design doc that feeds `mk:plan-creator`. It produces a document, never code: do not scaffold, build or invoke an implementation skill. The doc goes under `tasks/plans/<slug>/`; there are no memory writes.

| The user wants | Skill |
|---|---|
| To know whether the idea should exist, who needs it, the smallest wedge | this skill |
| Technical approaches to a validated requirement | `mk:brainstorming` |
| Scope and ambition of an existing plan | `mk:plan-ceo-review` |
| A plan for an agreed idea | `mk:plan-creator` |

A bare "brainstorm" request is ambiguous: ask whether the user wants product discovery or technical approaches (`mk:brainstorming` owns that rule).

## Process

1. **Context and mode** (`references/discovery-flow.md`, step 1). Ask the user's goal. Startup or internal project runs the startup diagnostic; hackathon, open source, research, learning or fun runs builder mode.
2. **Questions.** Startup: `references/startup-diagnostic.md`, six forcing questions routed by product stage, one at a time, with direct pushback. Builder: `references/builder-mode.md`, generative questions one at a time. With a fully formed plan, skip the questions but still do premises and alternatives.
3. **Premises and alternatives** (`references/discovery-flow.md`). Landscape search only with the user's consent and generalised terms. Challenge premises and have the user agree to each. Give two or more approaches when more than one path exists.
4. **Stop early when the evidence is missing.** If the diagnostic finds no evidence of demand, say so, recommend not building yet, name the cheapest validation, and stop; the doc is then optional.
5. **Design doc and handoff** (`references/design-doc.md`). One template with Startup-only lines marked; state the assignment and the next skill.

Ask one question at a time; one batched list of questions gets one shallow answer. Wait for each answer.

Product health questions about an existing product ("should I keep building this?", "why is retention bad?") use `references/product-lens-modes.md`.

## Status

End with DONE, DONE_WITH_CONCERNS, BLOCKED or NEEDS_CONTEXT as defined in `references/design-doc.md`.

## Gotchas

- Solutioning before the problem is understood: finish the problem statement before any technical discussion.
- Anchoring on the first idea: generate alternatives before judging any of them.
- Accepting a polished first answer: ask again for a name, a number or a behaviour.
- Treating enthusiasm as demand: ask what the person did, not what they said.
