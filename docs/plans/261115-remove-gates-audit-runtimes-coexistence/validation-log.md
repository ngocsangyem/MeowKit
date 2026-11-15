# Validation Log — 2026-11-15

Kept outside `plan.md` because the structural check caps that file at 80 lines.
The maintainer answered in Vietnamese; answers are recorded in English with the original wording where it was free text.

### Q1: The ship check (test, lint, type-check at commit and push) exists only on Claude Code; the Codex and Cursor bundles register none. Add a ship check for Codex and Cursor in this plan?
**Category:** Scope
**Options presented:** Claude Code only (Recommended) · Add to both · Add to Cursor only
**Answer:** Custom — "thêm cho cả hai nhưng khi đó chỉ lint, test cho những file thay đổi và có liên quan" (add to both, but then lint and test only the changed and related files)
**Rationale:** —
**Impact:** plan.md Goal, Acceptance Criteria, User-Confirmed Decisions; phase-02 Requirements 2, Architecture, File Inventory, Steps 1 and 5, Success Criteria 1 and 7, effort 8d (third pull request 2c); phase-01 Requirement 1, Step 3

### Q1a: Does the changed-and-related scope apply to all three runtimes or only to Codex and Cursor?
**Category:** Architecture
**Options presented:** All three runtimes (Recommended) · Codex and Cursor only
**Answer:** All three runtimes
**Rationale:** —
**Impact:** phase-02 Requirement 2, Architecture (one shared pre-ship lib in `bundled`)

### Q1b: When the test runner cannot name the tests related to the changed files, what should the ship check do? (Type-check stays project-wide.)
**Category:** Tradeoffs
**Options presented:** Run the full test suite (Recommended) · Lint and type-check only
**Answer:** Lint and type-check only
**Rationale:** —
**Impact:** phase-02 Requirement 2, Success Criteria 7, Risk Assessment ("related-test scope misses a regression elsewhere")

### Q2: With `MEOWKIT_HOOK_PROFILE=fast`, pre-ship skips the test, lint and type-check block. How should the fast profile behave at ship time?
**Category:** Risk
**Options presented:** Ship check ignores fast (Recommended) · Keep as is, doctor warns
**Answer:** Ship check ignores fast
**Rationale:** —
**Impact:** phase-02 Requirement 3, File Inventory, Step 1; phase-05 Key Insights

### Q3: The new completion check blocks the end of a turn when code was edited and no test, build or lint command passed afterwards. What should the default be?
**Category:** Tradeoffs
**Options presented:** On, block at most twice (Recommended) · On, notice only · Off, opt-in
**Answer:** Off, opt-in
**Rationale:** —
**Impact:** phase-04 Requirement 2, Risk Assessment, Next Steps; phase-03 Next Steps (enforcement matrix lists it as opt-in)

### Q4: The Cursor bundle has a kill switch (env var or a flag file under `.meowkit/state`) that an agent can write and that also disables the Cursor privacy gate. How should it be handled?
**Category:** Architecture
**Options presented:** Env var only, privacy ignores it (Recommended) · Keep as is, doctor warns · Remove the switch
**Answer:** Env var only, privacy ignores it
**Rationale:** —
**Impact:** phase-02 Requirement 6, File Inventory, Step 5; phase-05 Requirement 5, Key Insights

### Q5: Claude Code lets an action through when a hook crashes or times out; hosts from 2.1.295 offer `onFailure: "block"`. Enable it for the remaining guards in this plan?
**Category:** Risk
**Options presented:** `privacy-block` only (Recommended) · Both guards · Leave to another plan
**Answer:** `privacy-block` only
**Rationale:** —
**Impact:** phase-02 Requirement 3, Step 5; phase-05 Requirement 5 (host older than the floor is reported)

## Defaults stated to the maintainer and not objected to

- `plan approve` is removed; `doctor --hard-gates` keeps its name.
- `gate-rules.md` is retired.
- Budget and loop messages are advisory and do not stop work.
- Agent model pins stay; the tier rule text is corrected to match them.
- Sprint contracts stay as an autobuild document with no hook check.
- Plugin directories are scanned by `doctor` only with an explicit flag.

## Red-team escalations answered before the interview (recorded in red-team-findings.md)

- Model-fit audit of rules and agents: kept, as its own pull request.
- Mechanical fixes in Phase 4: kept, as three pull requests.
- Guard files after gate removal: `doctor` integrity check plus an optional host deny and sandbox profile.

### Pending Sweep Edits
- none — a literal search for 12 superseded terms found no stale reference outside the originating sections (two hits are deliberate: the Phase 1 fixture clears the kill-switch flag file that exists until Phase 2, and the Phase 2 "before" diagram).

### Whole-Plan Consistency Sweep — 2026-11-15T11:48:08+07:00
- Files reread: plan.md, phase-01-guard-self-test-and-host-probes.md, phase-02-remove-gate-mechanisms-standalone-ship-check.md, phase-03-gate-free-model-fit-instructions.md, phase-04-output-validation-without-gates.md, phase-05-coexistence-report-in-doctor.md
- Decision deltas checked: 12
- Reconciled stale references: 0
- Unresolved contradictions: 0

## Revision after the runtime-docs triage — 2026-11-15T12:09:59+07:00

Source: [research/runtime-docs-triage.md](research/runtime-docs-triage.md). The maintainer asked for all four plan changes (C1–C4), then answered:

### R1: Approve the revised plan (C1 cross-runtime double load, C2 edits read from the working tree, C3 Codex wording, C4 installed-but-not-running states)?
**Category:** Scope
**Options presented:** Approve · Modify further · Discard the revision
**Answer:** Approve
**Rationale:** —
**Impact:** phase-01 Requirement 5; phase-02 Requirement 6, Success Criteria 8; phase-03 Requirement 5; phase-04 Requirements 1–2, Architecture; phase-05 Requirements 5 and 8

### R2: Codex has a Stop hook. Add the opt-in completion check to the Codex bundle in this plan?
**Category:** Scope
**Options presented:** Not now (Recommended) · Add to Codex
**Answer:** Add to Codex
**Rationale:** —
**Impact:** phase-04 Step 9, File Inventory, effort 3.5d; plan.md Phases, User-Confirmed Decisions
