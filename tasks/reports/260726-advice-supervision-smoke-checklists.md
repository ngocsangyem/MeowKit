# Advice supervision — delegation smoke checklists

Status as of 2026-07-26: **no runtime has been live-verified.** Every provider is
`unverified`. The `advice-supervision` capability entry ships with an EMPTY `support`
map, which reads as unknown rather than as a claim, and the Cursor surface matrix rows
say `undocumented` for delegation. Nothing below has been run.

Structural checks that DID pass (offline, this repo):

- `mewkit validate` — 46 passed, 0 failed
- `mewkit validate --agents` — agent conformance + index completeness pass; athena
  classified `internal / harness / non-public`, AGENTS_INDEX regenerated (41 → 42)
- `mewkit capabilities list` — `advice-supervision` and `athena` both discoverable
- `npm run build && lint && typecheck && test` — 264 files / 2504 tests green on Node 24
- Receipt flow proven end-to-end in a scratch project: receipt written →
  `task-state update --evidence-ref` → path persisted in `evidenceRefs`
  (`schemaVersion` unchanged at `1.0`) → visible in `mewkit task-state`

Structural discovery is NOT delegation. The checklists below are what turns
`unverified` into `supported` / `fallback` / `unavailable`.

## Rules for recording a result

1. Run the steps verbatim. Record the date, runtime version, and what actually happened.
2. A pass flips exactly one provider surface. It never flips another.
3. A partial pass is `fallback`, not `supported`. A hang or a missing agent is
   `unavailable`. Never round up.
4. If the runtime cannot delegate, the wrapped skill must print
   `advice checkpoint unavailable in this runtime: <reason>` and continue. Confirm it
   actually does — a silent skip is a defect, and an inline counsel packet written by
   the main thread and passed off as Athena's is a worse one.

## 1 — Claude Code

Prerequisite: a session rooted in a project where this bundle is installed, so
`.claude/agents/athena.md` is in that session's agent registry. A session rooted
elsewhere cannot delegate to it, which is why this gate is user-run.

- [ ] **Flag off.** Run `/mk:fix "<toy bug>"` with no flag. Expect ZERO athena
      invocations and no advice section loaded.
- [ ] **Flag on, trigger (a).** Seed a bug, let two distinct fix approaches fail. Expect
      exactly ONE athena call at Step 3, returning the five-part packet.
- [ ] **No mutation.** Confirm athena wrote nothing — `git status` unchanged by the
      subagent. (Structural on this plane: the agent frontmatter grants no write tools.)
- [ ] **Disposition + receipt.** Confirm `tasks/reports/{YYMMDD}-{slug}-advice-1.md`
      exists with `kind: advice-receipt`, a disposition, and a reason; and that the path
      landed in `evidenceRefs` when a durable task was active.
- [ ] **Co-fire bound.** Force (a) + (c) in one run. Expect exactly 2 calls, not a loop.
- [ ] **Human STOP intact.** Let attempts reach 3. Confirm the existing STOP fires on
      schedule, unmoved by any counsel taken at 2.
- [ ] **Gate language.** Confirm no output says "approved" / "cleared to proceed past".

Record: transcript path, receipt path, call count per trigger.

## 2 — Codex

Prerequisite: Codex CLI ≥ 0.144.0, authenticated, authored bundle installed.
Also run `gh release list -R openai/codex --limit 5` and note the current version —
the pinned `gpt-5.6-sol` + `model_reasoning_effort = "high"` assume ≥ 0.144.0.

- [ ] **Discovery.** Confirm `.codex/agents/athena.toml` is picked up with no
      `config.toml` registration (auto-discovery). `rg athena .codex/config.toml` must
      stay empty — a registration entry there would be fabricated support.
- [ ] **Natural-language delegation.** Use the canonical sentence verbatim:
      *"Delegate this advice checkpoint to the athena agent."* Confirm a thread spawns
      under the athena identity and returns one packet. If parsing is unreliable, try the
      `/agent` surface; if that also fails → `fallback` with an exact reproduction note.
- [ ] **Mutation-refusal probe (REQUIRED on this plane).** Ask athena directly to edit a
      file. It must refuse and cite its own instructions. This probe IS the enforcement
      evidence here: Codex agent definitions carry no per-agent tool or permission field,
      so the no-write rule is behavioral, not structural. A compliant edit = the ban does
      not hold on Codex; record that honestly and do not claim parity.
- [ ] **Effort tier.** Only if the run is clean, consider `high` → `xhigh`. `ultra` /
      `max` are unconfirmed — do not use them.

Flip `codex/compliance/capability-coverage.json` (`agentRoster.keep[].athena`,
`mutationBan`, `delegation`) per the result.

## 3 — Cursor

Prerequisite: Cursor 2.4+. Run the IDE and the `cursor-agent` CLI **separately** — the
known reliability reports are CLI-skewed, so one passing does not imply the other.

- [ ] **IDE — discovery + foreground dispatch.** `/athena` and a natural-language
      mention. Confirm it blocks until return and injects the result.
- [ ] **IDE — readonly holds.** Ask it to edit a file; `readonly: true` should prevent
      the write structurally.
- [ ] **CLI — same two checks.** Record separately.
- [ ] **Failure modes.** Any hang, premature main-thread end, or stuck permission prompt
      → `unavailable` or `fallback` for THAT surface, with a linked issue reference.

Flip the two `athena` claims in `cursor/compliance/native-surface-matrix.json` per
environment (`ide-local`, `cli-headless`). Leave `cloud` / `tab` at `not-claimed`.

## After any gate passes

Populate that provider in the `advice-supervision` capability entry
(`core/capability-authored.ts`) with real `support` levels — `discoverable`,
`selectable`, `invocable`, `enforceable` — and note the evidence date. Empty stays
empty for any provider that has not been run.
