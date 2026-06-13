---
title: "mk:grill"
description: "Relentlessly interview the user about their own plan or design — one question at a time — resolving each branch of a decision tree until shared understanding. Claude is the interviewer; the user is the interviewee. Checkpoints every answer to docs/knowledge/<slug>.md so progress survives a context reset, flags unanswerable knowledge as gaps to chase, and ends by offering three handoffs. Read-only on the source doc."
---

# mk:grill

## What This Skill Does

Turns the usual direction around: instead of Claude answering or proposing,
**Claude interviews you** about a plan or design you already own — one question
at a time — and drives every unresolved branch of the decision tree to a
resolution. The output is a knowledge document that front-loads the tacit context
a downstream build skill would otherwise have to guess at.

It accepts either entry mode:

- **A doc path** — a plan / design / spec file. grill reads it and seeds the
  decision tree from its open branches (unresolved choices, unjustified
  decisions, TODOs, vague nouns, assumptions stated as fact). It never edits the
  source.
- **A verbal idea / topic** — grill seeds an empty tree and builds it through
  questioning.

The signature mechanic is **exactly one question per turn** — deliberately not a
batched multi-question prompt. One sharp question, your answer, an immediate
checkpoint, then the tree is re-evaluated and the next highest-leverage branch is
asked. Five questions or an hour are both valid lengths; depth, not count, is the
target.

## When to Use

- "Grill me on this plan"
- "Stress-test my design / interrogate my plan"
- "Get grilled on my design before I build it"
- You have a half-formed plan or design and want every assumption, ambiguity, and
  unresolved choice surfaced and answered before handing it to a build skill.

## When NOT to Use

| Need | Use this instead |
|---|---|
| Propose / compare technical approaches | `mk:brainstorming` |
| "Should we build this" — product validation | `mk:office-hours` |
| Claude should ANSWER questions about the repo | `mk:ask-me` |
| One-shot review of an existing plan | `mk:plan-ceo-review` |
| Apply named reasoning lenses to existing findings | `mk:elicit` |
| Multi-perspective architecture debate | `mk:party` |
| Constitution derived from the CODEBASE (not the human) | `mk:project-context` |
| Bug / error / root cause | `mk:investigate` |

## Usage

```bash
# Grill an existing plan/design doc (read-only on the source)
/mk:grill tasks/plans/260613-1254-payment-retry/plan.md

# Grill a verbal idea — no doc required
/mk:grill I want to add a retry queue for failed payment webhooks
```

**Argument hint:** `[doc path | verbal idea or topic]`

The only output is `docs/knowledge/<slug>.md`, written and updated after every
answer. The source doc, if any, is never modified.

## Core Loop

1. Pick the single highest-leverage unresolved branch.
2. Ask exactly one specific, concrete question about it — no batching, no menus.
3. Wait for your answer.
4. Restate the answer in one line to confirm understanding.
5. Checkpoint immediately to `docs/knowledge/<slug>.md` before asking the next
   question.
6. Re-evaluate the tree — the answer may close branches, open new ones, or expose
   a contradiction with an earlier answer (surfaced on the spot).
7. Repeat until termination conditions are met.

## Gap Flagging

When you cannot answer, answer thinly, or say "I don't own that", grill does not
paper over it. It records an **Open Gap** with the unresolved question, why it is
unresolved, and **who to ask** — then tells you to go get the detail and drop it
back into the knowledge doc. A flagged gap is a valid outcome, not a failure.

## Hybrid Termination

At each checkpoint grill surfaces a readiness signal — the remaining open branches
plus its judgment of whether high-leverage questions are exhausted. When branches
drain, it **proposes wrap-up** and asks you to confirm "done" or "keep going". It
never auto-terminates silently and never loops forever; you hold the stop button.

On confirmed wrap-up it offers three handoffs:

- `mk:skill-creator` — if the resolved design is a skill to build.
- `mk:plan-creator` (or `mk:brainstorming` if approaches are still open) — if it is
  a feature/system to plan.
- `mk:project-context` — to merge the extracted human knowledge into the project
  constitution.

grill offers all three and lets you pick; it does not auto-invoke the downstream
skill.

## Output Format

`docs/knowledge/<slug>.md`:

```markdown
# Knowledge: <Plan/Design Title>

**Source:** <doc path | "verbal idea">
**Started:** <date>  ·  **Status:** in-progress | wrapped

## Decisions
- **<branch>:** <answer> — <why>

## Q&A Log
1. **Q:** <question>
   **A:** <answer>

## Highlights
- <insight>

## Open Branches
- <branch>

## Open Gaps
- **<question>** — <why unresolved> → ask: <who/source>
```

## Safety Boundaries

- **Read-only on the source.** The plan/design doc is never edited; corrections
  flow through the chosen handoff. The only file grill writes is
  `docs/knowledge/<slug>.md`.
- **No `AskUserQuestion`.** The one-question-at-a-time loop is plain prose — batched
  question prompts are deliberately excluded from the skill's tools.
- **Never proposes the answer.** The moment a suggestion would replace a user
  decision, that is `mk:brainstorming` territory; grill asks, it does not decide.
