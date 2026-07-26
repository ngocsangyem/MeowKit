---
source: original
applies_to: [mk:fix]
governs: [mk:brainstorming, mk:plan-creator, mk:cook, mk:fix, mk:autobuild, mk:ship]
loaded_by: consuming skills on demand when --advice is present (NOT always-on)
trust_level: HIGH
---

# Advice Supervision (`--advice`)

**Core rule:** when — and only when — the user passes `--advice`, a supporting skill
may call the `athena` agent at a small set of **named checkpoints** to get
strategic supervision over one delivery run. Athena assesses the situation, makes
an evidence-backed operational recommendation, guides before work, rescues a
blocked run, reviews finished work, and may return work for correction.

Supervision is **evidence the human reads**. It is never an approval, never a gate,
never a substitute for verification.

Athena is a workflow-level strategic intelligence agent with stronger reasoning and
cross-phase visibility — and **no mutation authority**. The parent owns execution,
the dossier, receipts and routing. Existing specialists keep their verdicts. Athena
is public for an explicit stateless direct strategy consult where the provider exposes
one, and is also reachable through the `--advice` harness; it is never
orchestrator-routed and owns no lifecycle phase.

The mechanical half of this contract is enforced in code — stage/disposition
legality, caps, packet caps and content checks, dossier fields. Where prose and
those checks disagree, the checks are authoritative and the prose is the bug.

## 1 — Activation

- Fires ONLY on an explicit `--advice` flag on a skill that documents support.
- NEVER from SessionStart / Stop / any hook. Hooks may not invoke agents
  (`.claude/rules/post-phase-delegation.md` Rule 7).
- NEVER auto-enabled by a mode, tier, risk flag, score, or failure count.
- Orchestrated child jobs never self-supervise: a supervised parent does not hand
  `--advice` to the children it spawns.

Without the flag the checkpoint blocks are inert and cost nothing: the skill does
not load this file, makes zero calls, and writes no state or receipt.

## 2 — Cadence

```text
GUIDE → (executor works) → RESCUE* → REVIEW → RECHECK*
```

Checkpoints are **macro boundaries**, never per tool call, per file, or per loop
iteration.

| Stage | Purpose | Max per run |
|---|---|---:|
| GUIDE | Direction before work starts | 1 |
| RESCUE | Unblock a stalled or contradicted run | 2 (one per rework round) |
| REVIEW | Independent read of finished work, against evidence | 1 |
| RECHECK | Re-examine returned work | 1 |

Per-skill total ceiling:

| Skill | Cap |
|---|---:|
| `mk:brainstorming` | 4 |
| `mk:plan-creator` | 4 |
| `mk:cook` | 5 |
| `mk:fix` | 5 |
| `mk:autobuild` | 5 |
| `mk:ship` | 4 **per release stage** — `prepare`, `release` and `publish` each carry their own budget, charged by `--release-stage`. The flag is required for ship and refused for every other skill; it is fixed at `begin` and inherited by `commit`. |

Rules that keep the cadence bounded:

- A duplicate `checkpointId` is **idempotent** — it returns the prior result and
  does not consume a cap slot. This is what makes crash-and-resume safe. Ids are unique
  per RUN, not per partition: reusing one under a different stage or release stage is a
  naming collision and is refused, because returning another checkpoint's recorded
  result would silently skip the one the workflow believes it ran.
- `RECHECK` requires a prior `RETURN_TO_EXECUTOR`.
- A **second unresolved return escalates to a human.** There is no third opinion.
  Returns are counted within the budget that spent them, so on a partitioned skill a
  resolved return in one release stage and an unrelated one in another are two
  episodes, not one unresolved loop. The escalation flag itself stays run-wide: once a
  human has been asked, the whole run waits for them.
- Reaching a cap escalates; it never loops.
- A recorded call that names no partition, or names one the skill does not declare,
  counts against **every** partition. Skipping it would turn history written before the
  skill was partitioned — or a hand-edited value — into a free slot in each budget, so a
  run that had already spent its cap would acquire a full fresh one per stage. Counting
  it everywhere can only under-permit, which is the direction this contract errs in.

**Rescue complements human STOPs; it never delays them.** `mk:fix`'s rule — 3+
failed attempts ⇒ STOP and question the architecture with the user — fires on its
own schedule whether or not counsel was taken at two failures. The same holds for
the Gate 1 question, the Gate 2 question, and any explicit business decision.

## 3 — Input packet (the parent supplies)

A fork inherits no conversation, so the packet is the supervisor's entire world.
Fields: `runId`, `skill`, `stage`, `checkpointId`, `mission`, `lockedDecisions`,
`currentState`, `workerSummary`, `evidenceRefs`, `priorDirective`, `question`,
`riskAndReversibility`.

- Serialized cap **12 KiB UTF-8** — fail visibly BEFORE delegation, never truncate.
  A truncated packet asks a different question than the one intended.
- At most **5 evidence pointers**, each carrying `path`, `relevance`, `provenance`
  and a short `summary`. Provenance is mandatory: an unattributed path cannot be
  weighed, and a fresh fork cannot reconstruct it.
- **Never** a raw transcript, full diff or log, memory dump, secret/PII, or
  unrelated project history. Pass a pointer, not the payload.
- Start with the map; Athena reads only the detail it selects.
- Locked decisions and the exact current question appear at both start and end as
  attention anchors.

## 4 — Output packet (Athena returns)

Fields: `disposition`, `strategicAssessment`, `decisionRecommendation`,
`strategicDirective`, `requiredCorrections`,
`nextFalsifiableCheck`, `risksAndRollback`, `rejectedAlternatives`, `assumptions`,
`confidence`, `evidenceRead`.

Dispositions are **stage-specific**, and an illegal one is rejected before routing:

| Stage | Legal dispositions |
|---|---|
| GUIDE, RESCUE | `CONTINUE_WITH_DIRECTIVE`, `ESCALATE_TO_HUMAN`, `BLOCKED_MISSING_EVIDENCE` |
| REVIEW, RECHECK | `READY_FOR_EXISTING_GATE`, `RETURN_TO_EXECUTOR`, `ESCALATE_TO_HUMAN`, `BLOCKED_MISSING_EVIDENCE` |

`READY_FOR_EXISTING_GATE` means "the normal reviewer/gate is the correct next
step". It **never** means the gate is cleared.

- Output cap **600 words**. Volume is not rigor.
- `requiredCorrections`: max 5, ordered, each independently verifiable and each
  naming its `proofRequired`. `RETURN_TO_EXECUTOR` requires at least one.
- `decisionRecommendation` selects one operational path within the packet's locked
  scope and says why. It MUST escalate rather than override a locked business,
  security, compliance or gate decision.
- No `approve`, `clear`, `merge`, `deploy` or equivalent authority language, in any
  wording. Say "the evidence supports X".

### Transport status vs disposition

The A1 status block is **transport status only**: `DONE` means a valid packet
arrived; `BLOCKED` means no usable directive exists. The `disposition` field is the
sole workflow-routing signal. A `BLOCKED` transport may not carry a usable
directive, and a delivered packet must state a disposition — either mismatch is
refused rather than guessed at.

## 5 — Continuity dossier

One parent-owned file per run at the deterministic path
`tasks/reports/{supervisionRunId}-athena-supervision.md`.

Athena is a long-lived **lead**, never a long-lived **session**: every call is a
fresh isolated fork. Continuity therefore comes from this compact record, NOT from
a transcript, auto-memory, or a new supervisor store.

- Frontmatter + active summary stay under **2 KiB**, holding only run identity,
  current stage, locked-decision pointers, latest directive, correction count,
  receipt pointers, and next safe action.
- Historical receipts may sit below the active summary but are **never
  auto-loaded**. Never append full model output.
- The dossier **cannot** carry progress, verification, gate, approval, verdict or
  status fields. A candidate that does is refused, not stripped — silently dropping
  a field the caller believed it stored is worse than refusing.
- Two-step checkpoint marker: `pending` written BEFORE the call, `committed` after
  the result lands. A pending marker lets a resuming parent recognize an
  already-attempted checkpoint instead of spending another slot.
- Pointer placement: an active durable task gets an `evidenceRef`; a plan/run
  artifact gets a pointer; a one-off run keeps only the local dossier and has no
  automatic cross-session resume guarantee. **Never invent an active task**
  (`.claude/rules/task-state-emission.md` Rule 1).

A state or write failure disables supervision for that run, emits the exact
degraded notice, and lets the ordinary unsupervised workflow continue — but no
later Athena call may run until durable state is recovered.

## 6 — Correction cycle

`RETURN_TO_EXECUTOR` routes work back to its **current owner** — planner, developer,
tester, whoever owns it — never to Athena.

1. The executor addresses each correction or records why it is rejected.
2. Source changes advance `evidenceRevision` and mark stale verification/review
   evidence **superseded**; normal checks re-run.
3. Plan or scope changes additionally invalidate Gate 1 and require a new human
   approval. In-scope source corrections keep Gate 1 but invalidate downstream
   evidence.
4. Athena rechecks once by default. A second unresolved return escalates.

Superseded evidence must never read as current at a later gate or ship preflight.

**A correction's only write target is an existing `workflow-evidence.json` inside the
project.** The index lives under several roots but always under that name, so the name is
the check; the CLI refuses any other path. Without that bound, `--evidence` accepted any
JSON object in the project and the correction spread it and wrote it back — pointed at a
Gate-1-approved `visual-plan/plan.json`, which carries its own top-level `review.status`,
it flipped that status to `superseded`, injected fields the visual schema does not define,
and broke the artifact against its own pinned hash. Supervision does not write another
owner's artifact.

Both the boundary check and the name check run on the **resolved** path. A textual check
answers a question about the caller's string, not about the file that will be opened, and
reads follow symlinks: a link named `workflow-evidence.json` inside the project and
pointing outside it otherwise satisfied every check, and its contents were merged into the
correction and written back inside the repository. A path that does not resolve is absent,
and a correction supersedes recorded evidence rather than creating it, so it is refused.

## 6a — Composing with `--html`

`--advice` and `--html` are orthogonal. Neither implies the other, each is parsed
independently, and combining them changes no activation, approval, validation, export or
ownership. A run with both produces the same visual artifact, at the same path, validated
by the same validator, approved by the same human at the same gate, and exported by the
same owner as `--html` alone would for the same final Markdown.

They meet only in the correction loop, because a supervised correction edits Markdown and
the visual artifact pins hashes of it. The Markdown plan stays the source of truth;
REVIEW fires before the gate step where the visual preconditions are checked; and a
returned correction invalidates the artifact's pinned hashes exactly like any other
Markdown edit — rehash (which clears the prior visual approval), re-validate, re-review,
re-approve, then present the ordinary Gate 1. A stale artifact never reaches the gate
beside a corrected plan.

Athena approves no visual, edits no HTML, changes no filename or path, opens no browser,
and turns no dossier or receipt into a rendered artifact. This is structural: the adapter
grants read-only tools, so no such action is available to it.

## 7 — Prohibitions

Athena MUST NOT:

- Mutate anything: no source, test, fixture, plan, verdict, PM report, or memory
  write, and no command that alters the working tree. Only the parent writes the
  dossier/receipt.
- Interview the user. That is `advisor`, behind `mk:advise`, unchanged by this rule.
- Emit a verdict, score, grade, or security clearance. `reviewer`, `evaluator` and
  `security` own those.
- Approve, clear, unblock, or advance Gate 1, Gate 2, a security review, CI, a
  merge, a deploy, or any user business decision.
- Change the executor's model, profile, or effort. `--advice` supervises the
  workflow, not the model running it.
- Spawn another Athena or any lifecycle agent.

**Gate Authority Invariant** (`.claude/rules/gate-rules.md`): automation executes
BETWEEN gates and never supplies the authority OF a gate. An Athena directive is in
exactly the same class as an evaluator verdict or a green test suite — evidence
presented to a human at the gate, never the approval itself. Prose that lets
supervision advance a gate, in any wording, is a violation.

A directive is also **not verification**. Verification comes from tests, review
verdicts and validators. Supervision never counts toward it.

## 8 — Receipt

After each checkpoint the **parent** (never Athena) writes a receipt to
`tasks/reports/{YYMMDD}-{slug}-advice-{n}.md`:

```markdown
---
kind: advice-receipt
runId: <supervisionRunId>
stage: GUIDE | RESCUE | REVIEW | RECHECK
disposition: <the returned disposition, verbatim>
outcome: adopted | rejected | deferred
reason: <one line — required even when adopted>
taskId: <active task id, or "none">
provider: <runtime>
skill: <skill and workflow>
checkpointId: <named checkpoint>
---

This is a record of supervision, NEVER verification and never a gate approval.

**Question asked:** …
**Directive:** … (summary, not the full packet)
**Required corrections:** … (or "none")
**Evidence pointers:** …
**Next safe action:** …
```

`disposition` is Athena's returned routing signal; `outcome` is what the parent did
with it. They are separate fields because a parent may rightly reject a directive,
and collapsing them would hide that. The reason is required even when adopted —
"why" is what a later session cannot reconstruct.

A failed receipt write surfaces a one-line notice and never fails silently
(`.claude/rules/memory-read-rules.md`, no-silent-skip).

Old-format receipts using the retired `proceed | pause | escalate` vocabulary stay
readable, but MUST NOT be reinterpreted as correction authority.

## 9 — Propagation

Only `supervisionRunId` crosses an approved top-level lifecycle handoff between
skills that both document `--advice`. Spawned workers receive a task-specific
directive — never the flag, never the dossier, never routing ability.

## 10 — Fallback

If the runtime cannot discover the agent or execute a foreground delegation, the
skill prints exactly:

```
advice checkpoint unavailable in this runtime: <reason>
```

then continues unsupervised.

**Inline self-advice impersonating Athena is forbidden.** A recommendation written
by the agent that is stuck is not an independent check, and labelling it as one
corrupts the receipt.

## 11 — Direct consult vs embedded supervision

Where a runtime exposes direct mention of the agent, that is a **stateless strategy
consult**: Athena may assess a difficult situation, compare alternatives and make a
recommended operational decision, but creates no run receipt, correction routing or
cap accounting. It is NOT lifecycle supervision and must label itself accordingly.
It escalates rather than changing a locked business, security, compliance or gate
decision. Embedded supervision requires a valid `supervisionRunId`.

A direct consult returns a **strategy brief**, which is a different shape from a
checkpoint packet and deliberately cannot carry a `disposition`:

| Field | Required |
|---|---|
| `situation`, `decisionRecommendation`, `nextFalsifiableCheck`, `escalationPoint`, `confidence` | yes |
| `rejectedAlternatives`, `risksAndRollback`, `assumptions`, `evidenceRead` | no |

`disposition`, `requiredCorrections`, `strategicDirective`, `runId`, `stage`,
`checkpointId` and any receipt/dossier/correction field are **refused, not stripped**
(`mewkit advice validate-packet --packet-kind brief`). A disposition is a routing
signal for a run; emitted without one it reads as a governed decision that no run ever
governed, and a later reader cannot tell the difference. That is the impersonation
this section exists to prevent, so the refusal lives in a schema rather than in a
reviewer's memory.

The two routes are distinct capabilities, and neither may impersonate the other. The
route classifier refuses both impersonation directions, and `mewkit advice begin` is
the call site that consults it: a call claiming `embedded` is refused before any
dossier or receipt can be written, so the classification now sits in front of the
write path rather than beside it.

| Route | Requires | Forbidden |
|---|---|---|
| `direct` | nothing — it is stateless | any `runId`, `stage` or `checkpointId`; any dossier, receipt or cap accounting |
| `embedded` | a valid `runId` **and** `stage` **and** `checkpointId` | — |

A call claiming `embedded` without a valid run id is refused rather than downgraded:
supervision with nothing to resume from and no cap to bound it is not supervision. A
`direct` consult that arrives carrying run state is refused rather than stripped,
because once that state is written down the consult is indistinguishable from a
governed checkpoint — a directive would enter the audit trail that no run ever
governed. Only `embedded` may produce durable supervision artifacts — structurally, not
by convention: a dossier path cannot be built without a run id, and a direct consult has
none. A caller that needs an auditable directive must run a supervised checkpoint.

## 12 — Model policy

`--advice` never changes the executor's model. Athena maps to the strongest
advisory tier declared in the **provider adapter file** for the runtime in use. No
model name or id belongs in this contract or in any skill body
(`.claude/rules/skill-authoring-rules.md` Rule 7).

## Wiring status

This file is the canonical contract. Wrapper wiring lands per skill, and a skill
that has not been wired yet exposes no flag:

- `mk:fix`, `mk:cook`, `mk:brainstorming` (deep only), `mk:plan-creator`, `mk:autobuild`, `mk:ship` — wired. Each
  declares the flag, fires checkpoints at the stage boundaries above, and drives
  `mewkit advice begin|commit`, which is where the caps, stage legality, idempotency,
  dossier and receipt are actually enforced.

`mk:brainstorming` wires its **deep** workflow only. Its quick profile answers inline
in three steps and creates no scout, report, plan or memory entry; supervising that is
noise rather than safety (`skill-authoring-rules.md` Rule 6 — match control to risk).

`mk:workflow-orchestrator` exposes **no flag** and is not an entry point. When an
explicitly enabled run hands off, it carries `supervisionRunId` forward as an opaque
value at macro boundaries and nothing else, so a resumed workflow keeps one budget
rather than minting a fresh one.

Every other surface is excluded, and the exclusion is enforced in code rather than by
convention — `isSupervisedSkill` answers `false` for anything absent from the cap table,
so `mewkit advice begin` refuses the call. `mk:review` and `mk:evaluate`, and the
`security` and `project-manager` agents, own verdicts, scores and status that
supervision must not duplicate; `mk:advise` is the user-facing interview Athena is
forbidden from running; `mk:party`, `mk:loop` and `mk:investigate` run no delivery
lifecycle for a run id to bound.

### Parent-side commands

| Command | Enforces |
|---|---|
| `mewkit advice begin` | route contract, supervised-skill check, per-stage + per-skill caps, partition legality (`--release-stage`), idempotent `checkpointId`, pending marker |
| `mewkit advice commit` | stage/disposition legality, receipt validation (authority language, credentials, empty return), dossier commit, correction supersession |
| `mewkit advice status` | resume view: current stage, calls used, latest directive, next safe action |
| `mewkit advice validate-packet` | input packet, output packet, or direct-consult brief — `--packet-kind input\|output\|brief` |

A corrupt dossier is refused, never read as a fresh run — otherwise breaking the
file that counts the calls would be the cheapest way to buy unlimited ones.

Wrapping a new skill requires a registry row in the same change
(`.claude/rules/dead-weight-audit-rules.md` Rule 6).
