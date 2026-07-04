# Prompt Complexity Classifier

> Loaded by `mk:prompt-enhancer` during Step 1 (Decompose) as a lens on the
> INPUT prompt. It picks the enhancement strategy, the expected output length,
> and whether the rewrite should frame a research/discovery step — BEFORE the
> rewrite is built. It is model-agnostic: no step here emits vendor tokens.
>
> This classifier decides *content shape*; the flag modes in `mode-routing.md`
> decide *what sections render*. They are orthogonal — a Simple-rewrite prompt
> and a Migration prompt can both run in default or `--analyze`.

## Contents

1. [How to classify](#how-to-classify)
2. [Classifier table](#classifier-table)
3. [Output-length guidance](#output-length-guidance)
4. [Relation to Freedom level](#relation-to-freedom-level)
5. [Guards](#guards)

---

## How to classify

1. Read the input once. Match the strongest signal to a row in the table below.
2. Precedence when signals collide: **explicit user signal** > **destructive /
   security verb** (migration, delete, auth) > **default** (Simple rewrite or
   Coding implementation).
3. Pick exactly ONE type. A prompt that spans two (e.g. "research then plan")
   takes the LATER-stage type for output shape but preserves BOTH asks verbatim
   (intent preservation, `SKILL.md` Hard Constraint 1).
4. The type only tunes emphasis + length. It never changes the universal kernel,
   never adds a role the user did not ask for, and never performs the task.

Detailed per-type recipe templates live in `references/task-recipes.md` (loaded
only when a non-trivial type is matched). This file is the router; that file is
the detail.

---

## Classifier table

| Prompt Type | Signal (input cue) | Enhancement Strategy | Output Length | Need Research? |
|---|---|---|---|---|
| **Simple rewrite** | 1 short line; verb+object, no metric; no file ref | Minimal kernel; fill Goal + 1–2 `[FILL-IN]`; skip empty sections | Short (code block only) | No |
| **Coding implementation** | "add / implement / build / create"; file paths present | Full kernel; verification command in AC; Freedom MEDIUM | Medium | Optional (`--deep`) |
| **Code review** | "review / audit / check / assess" an existing artifact | Reshape to ASK for findings (severity + evidence); does NOT perform review | Medium | No |
| **Research task** | "research / find / compare / evaluate / investigate" | Allowed sources + citation requirement + confidence levels; data-first ordering; frames discovery only | Medium–long | Downstream (never self-research) |
| **Planning task** | "plan / roadmap / design the approach"; "don't implement, just plan" | Kernel + phases / dependencies / non-goals; enforce a "no implementation" constraint when stated | Medium | Optional |
| **Long-context task** | >5000 chars, or references >5 turns / NOTES.md / large dump | context-safeguards: data-first, question-last, compaction note; identifier-based context | Long (with anchoring) | No |
| **Migration task** | "migrate / port / upgrade / refactor across"; version bump | Freedom LOW; back-compat fence; per-step verification; preserve public contract | Medium–long | Optional |
| **Debugging task** | "bug / error / broken / why does X"; stack trace present | Reshape to symptom / repro / evidence / hypotheses / non-goals; keep hypotheses AS hypotheses | Medium | No |
| **Design / frontend task** | "UI / screen / component / mockup / layout" | Audience + product context + visual constraints + interaction states + responsive verification | Medium | No |
| **Multi-agent / orchestration** | "delegate / subagent / parallel / roles / handoff" | Role split + file ownership + reports path + handoff format; one owner per file | Long | No |

---

## Output-length guidance

Length is a target, not a cap. The rewrite must stay at the SMALLEST size that
carries the intent (right-altitude, `context-safeguards.md` §1).

- **Short** — only the sections the input needs. Do NOT emit empty
  `CONSTRAINTS:` / `ACCEPTANCE CRITERIA:` blocks full of placeholders for a
  one-line ask. One or two `[FILL-IN]` is enough signal.
- **Medium** — full kernel, 2–4 acceptance criteria, one output-format shape.
- **Long** — full kernel plus ordering / anchoring (long data first, ask last)
  and, when triggered, a context-engineering recommendation line (lazy gate,
  `context-safeguards.md` §7). Long never means padded — it means structured.

A simple prompt must not become a heavy prompt. If the classifier says Short,
resist adding sections the user gains nothing from.

---

## Relation to Freedom level

The classifier and the Freedom-level auto-suggestion (`SKILL.md` "Freedom Level
Auto-Suggestion") are complementary, not duplicates:

- Classifier → emphasis + length + research framing.
- Freedom level → how prescriptive the OUTPUT FORMAT is (LOW / MEDIUM / HIGH).

Common pairings (reference the Freedom table for the authoritative rule):

- Migration / destructive / security → Freedom **LOW**.
- Coding implementation / standard refactor → Freedom **MEDIUM**.
- Code review / research / design exploration → Freedom **HIGH**.

Do not restate the Freedom table here — it owns that decision.

---

## Guards

- **One type only.** Do not tag a prompt with three types "to be safe"; pick the
  strongest signal.
- **No role invention.** Review/research/debug reshaping asks the downstream
  agent to do the work — the enhancer never emits findings, research results, or
  a root cause of its own (role boundary, guarded by recipe canaries).
- **Preserve both asks on multi-stage prompts.** "Research A vs B then plan" keeps
  the research ask AND the planning ask verbatim.
- **Model-agnostic.** No row here selects XML, a vendor token, or a reasoning
  trigger. Target-specific tuning is `--analyze` target-notes only.
