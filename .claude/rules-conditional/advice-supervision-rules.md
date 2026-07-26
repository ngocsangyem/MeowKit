---
source: original
applies_to: [mk:fix]
loaded_by: consuming skills on demand when --advice is present (NOT always-on)
trust_level: HIGH
---

# Advice Supervision (`--advice`)

**Core rule:** when — and only when — the user passes `--advice`, a supporting
skill may call the `athena` agent at a small set of **declared checkpoints** to
get one-shot counsel. Counsel is **evidence the human reads**. It is never an
approval, never a gate, never a substitute for verification.

Athena's classification is `internal / harness / non-public` (the same shape as
`advisor`): it is not routed to by the orchestrator, not scored by
`mk:agent-detector`, and it owns no lifecycle phase. Invocation is a **one-shot
subagent fork with isolated context** — it returns a packet and ends.

## 1 — Activation

- Fires ONLY on an explicit `--advice` flag on a skill that documents support.
- NEVER from SessionStart / Stop / any hook. Hooks may not invoke agents
  (`.claude/rules/post-phase-delegation.md` Rule 7).
- NEVER auto-enabled by a mode, a tier, a risk flag, a score, or a failure count.
- Orchestrated child jobs never self-supervise: a supervised parent does not
  hand `--advice` to the children it spawns.

Without the flag, the checkpoint blocks below are inert and cost nothing: the
skill does not load this file.

## 2 — Checkpoint triggers (`mk:fix` slice)

Exactly three, each firing **at most once per run**:

| # | Trigger | Fires when |
|---|---|---|
| a | Stuck run | Root cause is evidenced AND two distinct fix approaches have failed |
| b | Irreversible step | Before a security-sensitive, public-contract, or data-loss-capable action |
| c | Residual risk | Verification passed but the remaining risk is unclear |

Never per tool call. Never per loop iteration. Never per file. Triggers MAY
co-fire in one run, so the worst case is three calls total.

**Trigger (a) complements the human STOP, it does not replace or delay it.**
`mk:fix`'s existing rule — 3+ failed attempts ⇒ STOP and question the
architecture with the user — still fires on its own schedule whether or not
counsel was taken at two failures.

## 3 — Input packet (the parent supplies)

The calling skill assembles all five fields inline in the delegation prompt. A
fork inherits no conversation, so an omitted field is simply missing.

1. **Task and exact question** — the outcome being pursued, and the one decision
   counsel is wanted on.
2. **Constraints and user decisions** — including decisions that must not be
   silently reversed (`.claude/rules/core-behaviors.md`).
3. **Evidence** — file paths, commands run, summarized observations.
4. **Attempts** — what was tried, what happened, why it failed.
5. **Options and risk** — candidate paths, risk class, and whether the step is
   reversible.

## 4 — Output packet (Athena returns)

1. **Disposition advice** — proceed / pause / escalate to the human.
2. **Next falsifiable check** — the cheapest observation that would disconfirm
   the current hypothesis.
3. **Critical risks + rollback note.**
4. **Alternatives rejected, and why.**
5. **Assumptions, missing evidence, and a stated confidence level.**

## 5 — Prohibitions

Athena MUST NOT:

- Interview the user, or reframe the problem through questions. That is
  `advisor`'s job, behind `mk:advise`, and is unchanged by this rule.
- Mutate anything: no file writes, no edits, no test or fixture changes, no
  command that alters the working tree.
- Own a plan, report, transcript, or task record.
- Change the executor's model, profile, or effort. `--advice` supervises the
  workflow, not the model running it.
- Approve, clear, unblock, or advance Gate 1, Gate 2, a security review, CI, a
  merge, a deploy, or any user business decision.
- Spawn another Athena, or any lifecycle agent.

**Gate Authority Invariant** (`.claude/rules/gate-rules.md`): automation
executes BETWEEN gates and never supplies the authority OF a gate. An Athena
recommendation is in exactly the same class as an evaluator verdict or a green
test suite — evidence presented to a human at the gate, never the approval
itself. Prose that lets counsel advance a gate, in any wording, is a violation.

A recommendation is also **not verification**. Verification comes from tests,
review verdicts, and validators. Counsel never counts toward it.

## 6 — Disposition and receipt

After each checkpoint the **parent** (never Athena) writes a receipt to
`tasks/reports/{YYMMDD}-{slug}-advice-{n}.md`, where `{n}` is the checkpoint
number within the run:

```markdown
---
kind: advice-receipt
disposition: adopted | rejected | deferred
reason: <one line>
taskId: <active task id, or "none">
provider: <runtime>
skill: <skill and workflow, e.g. mk:fix / standard>
checkpoint: <trigger a | b | c, named>
---

This is a record of counsel, NEVER verification evidence.

**Question asked:** …
**Recommendation:** … (summary, not the full packet)
**Evidence pointers:** …
**Next safe action:** …
```

The header line is verbatim, and the reason is required even when the counsel
was adopted — "why" is the part a later session cannot reconstruct.

### Where the pointer goes

| Situation | Action |
|---|---|
| An active durable task record exists | `mewkit task-state update <id> --evidence-ref <receipt path>` — the receipt joins `evidenceRefs`, and `mewkit task-state` lists it on resume |
| No active durable task (a one-off run) | Keep the receipt file, skip the pointer. Never invent a record (`.claude/rules/task-state-emission.md` Rule 1) |

A failed receipt write surfaces a one-line notice and the workflow continues. It
never blocks, and it is never skipped silently
(`.claude/rules/memory-read-rules.md`, no-silent-skip).

### Trace

Optional, and only for trigger (a): a checkpoint reached because the run was
genuinely stuck is friction, and recording it lets `mewkit trace propose` group
repeated stalls at the same place.

```
mewkit trace --friction "advice checkpoint: <one line>" --responsibility failure-attribution
```

Triggers (b) and (c) are not friction — do not log them there. The trace record
is telemetry; the receipt file is the durable record, and neither is verification.

## 7 — Propagation

The flag follows only an **explicit lifecycle handoff** between skills that both
document `--advice` support. It is not inherited by spawned agents, background
jobs, or nested skill calls. In the current slice no handoff target exists, so
in practice the flag ends with the run that received it.

## 8 — Fallback when the runtime cannot delegate

If the running provider cannot discover the agent or cannot execute a one-shot
foreground delegation, the skill prints exactly:

```
advice checkpoint unavailable in this runtime: <reason>
```

then continues unsupervised.

**Inline self-advice impersonating Athena is forbidden.** The main thread must
not write a counsel packet and present it as if a supervisor produced it: a
recommendation from the agent that is stuck is not an independent check, and
labelling it as one corrupts the receipt.

## 9 — Model policy

`--advice` never changes the executor's model. Athena maps to the strongest
advisory tier declared in the **provider adapter file** for the runtime in use
(the agent definition on each plane). No model name or id belongs in this
contract or in any skill body — see `.claude/rules/skill-authoring-rules.md`
Rule 7.

## Integrations

- `mk:fix` standard and deep workflows — the three triggers above.
- Any future skill wrapped under `--advice` loads this file the same way, JIT,
  and declares its own trigger table. Wrapping a new skill requires a registry
  row in the same change (`.claude/rules/dead-weight-audit-rules.md` Rule 6).
