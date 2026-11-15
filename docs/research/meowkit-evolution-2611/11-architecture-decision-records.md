# 11 — Architecture decision records (proposed)

Baseline `main` @ `c7ff0a9e`. Every record here is **PROPOSED**: none is accepted, and none
has been written to `docs/architecture/adr/`. Each states the decision as found, the evidence,
the alternatives and what would reverse it. Recommendation IDs point into the deliverables
(`C-` 05, `K-` 06, `O-` 07, `S-` 08, `Y-` 09, `A-` 10, `M-` 03, `H-` 04; `E`/`P` are experiments
and probes in 12).

Two facts frame all ten records:

- **No outcome measurement exists.** Nothing in the repo runs a model on a task with and without
  MeowKit (VERIFIED — R1 claim 13). Every "this mechanism helps" and every "this mechanism is
  dead weight" is therefore untested. Records below separate changes justified on mechanical
  grounds from changes that need an experiment first.
- **The maintainer has already documented several limits** (the approval receipt is
  "agent-writable by design"; Codex is "experimental"). Records do not treat those as
  discoveries.

---

## ADR-01 — State what the guards are: accident guards, with the boundary delegated to the host

**Context.** Three hooks block for real on Claude Code: the plan gate on `Edit|Write`, the
privacy block on reads, and pre-ship on `git commit|push|merge` (VERIFIED — R1 claims 1, 4, 6).
Each is bypassable by an agent with shell access: Bash writes are unguarded, `.claude/` is
writable under the plan gate, the approval receipt can be self-stamped by a pre-approved command,
and the ship trigger is a literal string match (VERIFIED — R1 claims 2–4). No sandbox, deny or
ask rules ship (L-12). Other harnesses read at source state the same position outright: the OS
sandbox is the only boundary against an adversarial model (VERIFIED — D07; D06). Prose rules are
context, not enforcement, per the host's own docs (DOCUMENTED — R2).

**Proposed decision.** Keep the three guards and describe them as what they are: controls that
stop accidental, unplanned and scope-drifting work. Harden them where that is cheap (S-01 to
S-07). Document host-level sandbox and deny rules as the boundary against a deliberate or
misled agent, and ship them as optional configuration beside the hooks, not instead of them
(S-11 to S-15, H-08). Reword claims that say more than the mechanism does (S-16 to S-18).

**Alternatives.**
1. Leave as is — keeps current behaviour; keeps the gap between wording and mechanism.
2. Try to make the hook gates unforgeable — not achievable while the agent has a shell; cost
   without a real boundary.
3. Replace the hooks with host deny rules only — loses the dynamic condition ("an approved plan
   exists"), which a static rule cannot express (INFERRED — D10).

**Trade-offs.** Honest wording reads as weaker marketing. Narrower pre-approved permissions add
prompts. Fail-closed hook configuration needs host 2.1.295 or later and does not cover
Stop-class events (DOCUMENTED — R2).

**Validation.** The enforcement replay suite (E8) run before and after: each hardened bypass
class must show a host-level block. **Revert:** restore `settings.json` and the hook files from git.

**Open for the maintainer.** Whether "NON-NEGOTIABLE / cannot be bypassed" stays as deliberate
emphasis for the model (it may still help instruction-following) or is reworded. Evidence on
emphatic wording for current models is vendor testimony only (M-06 proposes a test).

---

## ADR-02 — Evidence before structure: no removal or merge without mechanical grounds or a measurement

**Context.** The audits produced many REMOVE, MERGE and SIMPLIFY proposals. The reviewer found
that a large share rest only on "no benefit measured" (R1 §5). Absence of evidence is not
evidence of absence, and the audits themselves lean towards minimalism.

**Proposed decision.** Classify every structural change into one of three kinds and treat them
differently:

| Kind | Grounds | Action |
| --- | --- | --- |
| Mechanical | unwired, unreachable, byte-duplicate, dead reference, contradicts its own docs | act now (C group A, Y-01 to Y-05, O-02 to O-05, M-01, M-03) |
| Structural | measured size or overlap | experiment first (E1–E7, E9) |
| Judgement | opinion | do nothing until a structural or mechanical reason appears |

Build the smallest outcome-evaluation capability that makes the second kind decidable
(ADR-03 covers where it lives).

**Alternatives.** Prune now on judgement (fast, risks removing something that works);
freeze everything until experiments finish (safe, leaves known defects in place).

**Validation.** Each removal that follows an experiment cites its result. **Revert:** git.

---

## ADR-03 — Outcome evaluation lives outside the shipped kit and drives the host headlessly

**Context.** The host's plugin-eval tool exists and has a with/without arm, but it has no
custom graders and loads no project `.claude/`, rules or `CLAUDE.md`, so it cannot evaluate a
flat-copy MeowKit install (DOCUMENTED — deliverable 12 tooling check). Headless runs can pin
model and effort, cap turns and spend, and emit cost as JSON (DOCUMENTED). `mk:benchmark` is a
manual stub with an empty results directory (VERIFIED — D05). `tasks/` and `.meowkit/` ship in
the kit and must stay clean of work artefacts (maintainer constraint).

**Proposed decision.** A maintainer-only driver that installs each arm into a fresh fixture
clone and runs the host headlessly with hidden-test grading. Results stored outside shipped
directories. No eval verb in the CLI (K-09, O-12, O-15). Use the host's plugin-eval tool only
where it fits (skill discoverability, E7).

**Alternatives.** Extend `mk:benchmark` inside the kit (ships eval machinery to users who do
not need it); add an eval verb to the CLI (more surface, no demonstrated need — REJECT in 06);
rely on public leaderboards (contaminated and not MeowKit-relevant — D08).

**Trade-offs.** Authoring an original task suite is the main cost. Small suites detect only
large effects (12 §8 shows the arithmetic).

**Validation.** The first-week slice in 12 §9 produces a baseline and one paired comparison.
**Revert:** delete the driver; nothing ships.

---

## ADR-04 — Observability: repair what exists, delegate collection to the host, build no backend

**Context.** Today's signals mislead: "cost" is characters divided by four and never resets;
session-end fires per turn; three logs have no consumer; budget and loop "blocks" print plain
text that the host does not show to the model (VERIFIED — D05, R1 claim 8; visibility
DOCUMENTED — R2, untested live). Hooks do not receive token usage or, reliably, model identity;
the host's own telemetry and status-line input do (DOCUMENTED — D10, R2).

**Proposed decision.** Fix the mechanical defects (O-01 to O-06), run the visibility probe
first (O-10 / P-series), then treat host telemetry as the source of truth for tokens, cost,
delegation, tools, permissions and errors (O-07). The CLI may normalise and inspect; it does
not store or ship a backend (O-08 REJECT).

**Alternatives.** Keep the current logs (leaves misleading numbers in place); build a backend
(no demonstrated problem that needs one; privacy cost).

**Open for the maintainer.** Whether a budget should ever stop work (O-13) and whether the kit
should ship telemetry enablement (O-14).

**Validation.** O-11: MeowKit totals against host totals on ten runs. **Revert:** git.

---

## ADR-05 — Memory: keep Markdown and grep, fix correctness, reject a memory engine

**Context.** The team store has never held content in this repo beyond a fifteen-minute window
(VERIFIED — 09 §1). Reads are a grep the model is told to run; nothing is mechanical. The write
lint is an English pattern list that accepts paraphrase, cross-script look-alikes and split
phrases (VERIFIED — R1 claim 9). `--prune` is documented and not implemented. The ship-time lint
skips when the CLI is absent. No study compares file memory with vector memory for coding
agents; unfiltered or wrong memory gives little or negative benefit (RESEARCH-SUPPORTED — R2).
A more elaborate system read at source (bounded files, frozen snapshot, write-time scan) has no
measured benefit either (VERIFIED — D07).

**Proposed decision.** Keep the two-file design. Fix the mechanical items (Y-01 to Y-05).
Treat anchoring entries to a path and commit, a per-entry cap, and narrow lint extensions as
experiments (Y-06 to Y-08). Instrument reads before any benefit claim (Y-09, E6). A vector
database or memory engine is REJECTED until the current design is shown insufficient.

**Open for the maintainer.** The store is documented as committed team memory, yet the kit
must ship with it empty (Y-12); who may write to it (Y-11); whether 36 agents need a `memory:`
scope that also grants write tools to 21 agents that do not declare them (Y-10, S-09).

**Validation.** E6 (empty / relevant / irrelevant / stale / adversarial seeds). **Revert:** git.

---

## ADR-06 — Multi-agent: no orchestration runtime; keep parallel-write rules; specialists pending an A/B

**Context.** Evidence that multi-agent beats a single agent on software tasks at matched budget
is weak in both directions for current models: one software source on a 20-task subset with
2025 models, and a worktree study with unmatched compute (R2 re-grade). No harness read at
source ships named specialists or phase gates by default (VERIFIED — D06, D07). In MeowKit,
`orchestrator` is never spawned and the status protocol is checked by nothing (VERIFIED — D03).
MeowKit's parallel-write rules match the one conflict study found (RESEARCH-SUPPORTED — R2).

**Proposed decision.** REJECT an orchestration runtime inside the toolkit (A-06). DEFER the
Supervisor–Lead–Peer layer and agent-teams adoption (A-05). KEEP no-overlap, worktree isolation
and test-after-merge (A-03). Decide specialist-versus-generic agents, reviewer context, and the
cap of three by experiment (A-01, A-02, A-04, A-11; E4, E5).

**Alternatives.** Collapse to a single agent now (unsupported by evidence); adopt
Supervisor–Lead–Peer (the article offers no experiments or cost data — D11).

**Open for the maintainer.** `orchestrator` (A-07) and the unchecked status protocol (A-08):
mechanical grounds exist, but both are design choices — options keep / wire / remove.

**Validation.** E4 at equal token budget and at equal wall-clock. **Revert:** git.

---

## ADR-07 — Model adaptation: one source of truth now; keep or drop density tiers by experiment

**Context.** The density selector is a model-id allowlist that gives an older model LEAN and
the newest models FULL; the detector disagrees with it; the matrix doc says something else
(VERIFIED — R1 claim 10). Tier routing is an instruction; twelve agents are pinned to one model
id, including `developer`, against the tier rule (VERIFIED — D03, R1 claim 11). Model identity
is absent from about half of local sessions because the host does not always send it
(VERIFIED locally; DOCUMENTED — R2). Vendor guidance says older prescriptive scaffolding hurts
newer models, with no ablation; real harnesses that vary scaffolding do so after measuring
(D08, D07).

**Proposed decision.** Fix the disagreement mechanically: one lookup, one doc (M-01, M-03).
Do not key anything on model-family names beyond that. Whether density tiers exist at all is an
experiment (M-02, E9); if a key is kept, prefer declared effort and measured capability over
names.

**Alternatives.** Remove adaptive density now (no evidence it hurts either); extend the
allowlist for each new model (permanent maintenance, same failure next release).

**Validation.** E9. **Revert:** git.

---

## ADR-08 — Gates: keep both human gates; make the documented exceptions real or retract them

**Context.** The two gates are the kit's authority controls. The three documented Gate 1
exceptions have no implementation: the hook blocks any source edit without a plan and receipt,
so the quick-fix and trivial-tier paths cannot work as documented (VERIFIED — R1 claim 5).
The contract gate blocks any dated plan with no contracts directory unless a LEAN override is
set, although the rules scope contracts to full-density autobuild (VERIFIED — R1 5b). A full
run asks for about 83K tokens of workflow text and five or six human stops (VERIFIED estimate —
D03). Users approve about 93% of permission prompts (DOCUMENTED — R2). No head-to-head of rigid
versus adaptive workflows exists (H3 is HYPOTHESIS).

**Proposed decision.** Keep both gates. Resolve the exception contradiction one way or the
other (S-04) and state the contract-gate scope (S-20). Treat risk-keyed triggers — gating on
reversibility and blast radius instead of file count — as an experiment, with the gates kept
(A-09, E3).

**Alternatives.** Remove Gate 1 for small tasks by prose only (already the documented state,
and it does not work); drop the gates for capable models (no evidence; removes authority).

**Open for the maintainer.** Implement the exceptions or retract them; contract-gate scope;
what counts as approval proof (S-24).

**Validation.** E3 with human interruptions and unauthorised actions as co-primary metrics.
**Revert:** git.

---

## ADR-09 — Portability: claim what is carried, per host

**Context.** Instruction text, `SKILL.md` and MCP are portable across hosts. Hooks, subagents,
sandbox policy and telemetry are not: event names, decision formats, exit-code meaning and
trust requirements differ (VERIFIED/DOCUMENTED — D10, D06). On Codex the kit registers two
hooks and no ship gate; the Cursor bundle ships four fail-closed gates while the lifecycle
table shows "unknown", and has an undocumented switch that downgrades them (VERIFIED — 06).
The lifecycle table overstates the Claude Stop gate and lists a subagent-stop hook that is
empty. No live Codex or Cursor run exists in this research.

**Proposed decision.** Derive lifecycle claims from what each bundle registers (K-01), publish
per-host rows in the README (K-07), record or remove the Cursor switch (K-03), and run the
live host checks before any parity statement (K-08, E10). Adding hosts is not proposed.

**Alternatives.** Keep the current wording (the README already hedges Codex; the CLI output
does not); drop non-Claude targets (a maintainer decision the evidence does not force).

**Validation.** E10: same payload, same decision, on each host. **Revert:** git.

---

## ADR-10 — CLI scope: installer, verifier and honest reporter; not a control plane

**Context.** On main the Rust `mewkit` is the only CLI. Enforcement verification
(`doctor --hard-gates`), dry-run, ownership-based uninstall, backups and upgrade safety exist
and work (VERIFIED — D04, 06). Two guard-disabling project settings leave `doctor` green
(VERIFIED — 06 f). Kit integrity is a checksum from the same release with no signature, and
`main` has no branch protection although the release guide names it as root of trust
(VERIFIED — 06). The documented install path does not work today because no release is pinned;
this is an unreleased-main state, not a shipped defect (VERIFIED — 06 a, b).

**Proposed decision.** KEEP the existing verification verbs. IMPROVE `doctor` to show weakened
guards (K-04). State release status and what the checksum covers (K-05, K-06). REJECT trace
export and an eval verb for lack of a demonstrated problem. Release integrity beyond a checksum
is a maintainer decision (S-22). The Rust rewrite is a decision already taken and is not
revisited.

**Alternatives.** Grow the CLI into capability negotiation and telemetry export (no
demonstrated need); leave `doctor` as is (a disabled guard reads as healthy).

**Validation.** The trial in 06 f repeated after the change must show the weakened guards.
**Revert:** git.
