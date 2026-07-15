---
title: "mk:advise"
description: "Turn a raw decision into one honest recommendation after confirming the real problem."
---

# mk:advise

`mk:advise` turns a raw idea or decision into **one honest recommendation**. It
asks one question at a time, challenges the initial framing, and does not give a
verdict until you confirm the problem it will address.

## When to Use

- “What should I do about our slow build?”
- “Advise me on splitting this service.”
- “Am I approaching this migration right?”
- You want a single recommendation and are open to discovering that your
  original question is not the real problem.

## Route Fences

| If you need… | Use | Why |
|---|---|---|
| Interrogation of your plan without a recommendation | `mk:grill` | It asks questions but deliberately does not decide for you. |
| Alternatives for an already validated problem | `mk:brainstorming` | It compares approaches rather than re-examining the problem. |
| A verdict on whether to build an idea at all | `mk:office-hours` | It is for product-existence and validation questions. |
| Several perspectives debating a trade-off | `mk:party` | Advise gives one advisor’s verdict. |
| A phased implementation plan | `mk:plan-creator` | Advice ends before planning begins. |

## Usage

```bash
/mk:advise What should I do about our slow CI pipeline?
```

**Argument hint:** `[raw idea or decision]`

## Workflow

1. **Interview** — asks one decision-changing question per turn, usually two to
   six questions.
2. **Reframing gate** — states the problem, requirements, goals, non-goals, and
   constraints; you must confirm or correct this framing.
3. **Advice packet** — after confirmation, returns: verified context, confirmed
   reframing, verdict, do/don't guidance, bounded cheaper alternatives,
   benefits, trade-offs, an ordered checklist, success metrics, and unresolved
   questions.

An unwelcome answer is valid: “do nothing,” “you do not need this,” or “solve a
different problem first” can be the recommendation.

## Boundaries and Saved Artifacts

Advise does not create plans, ADRs, code changes, review verdicts, or curated
memory decisions. It also does not automatically start `mk:plan-creator` or
`mk:cook`; ask separately if you want to act on the advice.

Each advisory turn resumes from a checkpoint at
`session-state/<advise-run>/transcript.json`. If you explicitly ask to save the
result, it creates one report at
`tasks/reports/advise-<YYMMDD-HHMM>-<slug>.md`.

If the isolated advisor profile or relay is unavailable, advise runs inline and
explicitly tells you that the recommendation comes from the current conversation
instead of an independent advisor context. It never substitutes this fallback
silently.

## Related Reference

- **[advisor](/reference/agents/advisor)** — the isolated executor used by this skill.
- **[mk:grill](/reference/skills/grill)** — interview without a recommendation.
- **[mk:brainstorming](/reference/skills/brainstorming)** — compare alternatives for a settled problem.
- **[mk:office-hours](/reference/skills/office-hours)** — test whether an idea is worth building.
