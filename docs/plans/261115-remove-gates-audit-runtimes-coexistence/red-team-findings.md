# Red Team Findings — 2026-11-15

**Plan:** tasks/plans/261115-remove-gates-audit-runtimes-coexistence/plan.md
**Personas used:** Assumption Destroyer, Scope/Complexity Critic, Security Adversary
**Findings:** 15 after merging 30 raw findings (15 accepted, 0 rejected; 4 of the 15 were escalated to the maintainer and accepted in the form the maintainer chose)
**Severity breakdown:** 1 Critical, 12 High, 2 Medium
**Cross-persona blind spots:** 1 promoted to a finding, 1 noted concern, 0 personas reported "None observed"

---

## Finding 1: Phase 3 is not one reviewable pull request or a 4-day job
- **Severity:** Critical
- **Location:** Phase 3, "Related Code Files" and "Deep Phase Map"; plan.md: Phases
- **Flaw:** One pull request rewrote about 380 prose files across three trees by hand, plus validators, recordings and manifests, in 4 days. Only four of eight criteria are mechanical.
- **Failure scenario:** Review becomes a spot check; the phrase checker passes while prose is wrong; bundles drift; the phase overruns and blocks everything behind it.
- **Evidence:** "126 files in 37 skills … 123 and 112 bundle files"; "one pull request per phase"; effort "4d".
- **Suggested fix:** Split into pull requests; drive deletions with a mapping script over all three trees; re-estimate.
- **Category:** timeline
- **Disposition:** Accept — file counts are verified; the estimate does not survive them.
- **Applied to:** phase-03 (four pull requests, mapping script, 9d), plan.md (Phases)

## Finding 2: The goal claimed a ship check on three runtimes; two have none, and the one that exists has blind forms
- **Severity:** High
- **Location:** plan.md: Goal, Acceptance Criteria; Phase 2, Requirements
- **Flaw:** Codex and Cursor register no ship check. On Claude Code the parser cannot see `bash -c`, scripts, Makefiles or other tools; fast-profile and timeout behaviour were undecided.
- **Failure scenario:** A failing commit ships on Codex or Cursor, or through a wrapper on Claude Code, while docs say the check "still refuses".
- **Evidence:** Goal: "On Claude Code, Codex and Cursor … still refuses a commit or push"; Phase 1: "Codex and Cursor register no ship check".
- **Suggested fix:** State the guarantee per runtime; list uncovered forms; decide fast-profile and timeout behaviour before Phase 2.
- **Category:** scope
- **Disposition:** Accept — the two statements contradicted each other.
- **Applied to:** plan.md (Goal), phase-02 (Success Criteria 6, Non-Functional), phase-03 (enforcement matrix); adding a ship check to Codex and Cursor goes to the validation interview

## Finding 3: `main` would sit between gate removal and its replacements
- **Severity:** High
- **Location:** plan.md: Phases, Constraints; Phase 2 to Phase 4 ordering
- **Flaw:** Phase 2 removed enforcement and `plan approve`; the text telling agents to wait for approval, the completion check and the privacy fixes landed in later pull requests.
- **Failure scenario:** An install from `main` mid-sequence has rules that demand a verb that no longer exists, an inert completion check and the known privacy gaps.
- **Evidence:** "Phases 3, 4 and 5 start only after this phase merges"; "inert until Phase 4".
- **Suggested fix:** One integration branch; `main` receives a single merge once Phase 4 is green.
- **Category:** timeline
- **Disposition:** Accept — cheap and removes the window.
- **Applied to:** plan.md (Constraints), phase-02 (Risk Assessment)

## Finding 4: Nothing protects guard files, hook registrations or out-of-project paths once the plan gate is gone
- **Severity:** High
- **Location:** Phase 2, Architecture; plan.md: Risk Assessment
- **Flaw:** After the change an agent can edit `.claude/hooks/**`, `settings.json` and both `hooks.json`. The risk row cited the completion check, which detects unverified edits, not out-of-scope ones.
- **Failure scenario:** Injected text makes the agent remove the `privacy-block` registration; nothing blocks it and `doctor` stays green.
- **Evidence:** "after: Edit|Write → privacy-block only"; mitigation "Completion check; optional host deny and sandbox profile documented".
- **Suggested fix:** A write fence on guard files, or an integrity check, and a real optional host profile.
- **Category:** architecture
- **Disposition:** Accept in the maintainer's chosen form — escalated because it is adjacent to the locked gate-removal decision; maintainer chose the `doctor` integrity check plus an optional host profile with a test.
- **Applied to:** phase-05 (Requirements 6–7, integrity.rs), plan.md (Risk Assessment, Key Deliverables, User-Confirmed Decisions)

## Finding 5: Upgrade for customised or old installs can leave a registration pointing at a deleted file
- **Severity:** High
- **Location:** Phase 2, Requirement 5 and Step 7
- **Flaw:** The upgrade test covered only a clean previous-kit install. Installs with no ownership index, hand-edited settings or a modified retired file were not covered; no retire order was stated; no upgrade notes.
- **Failure scenario:** A registration survives while its file is deleted; with a fail-closed host setting every edit is blocked.
- **Evidence:** "an upgrade test per runtime from a previous-kit fixture".
- **Suggested fix:** Strip registration before file; four more fixtures; `doctor` flags a registered hook with a missing file; changelog and upgrade notes.
- **Category:** cross-cutting
- **Disposition:** Accept — promoted from two converging blind spots.
- **Applied to:** phase-02 (Requirement 5, Step 7, Risk), phase-05 (integrity row), phase-03 (Requirement 7)

## Finding 6: Probe results are prerequisites, but the plan treated the probes as optional and had no fallback
- **Severity:** High
- **Location:** Phase 1, Requirement 4; Phase 2, Step 5; Phase 4, Requirement 3
- **Flaw:** Three phases depend on live-probe results. No design existed for "no model-visible channel" or for `onFailure` not behaving as documented; exit-code and session-identity fields were not probed.
- **Failure scenario:** The probe shows stdout is invisible and Phase 4 has no design; fail-closed settings do nothing on an older host.
- **Evidence:** "through the channel the Phase 1 probe confirmed"; "ask before running".
- **Suggested fix:** Make probes mandatory; add a decision table with a fallback per outcome; probe exit code, session key and re-entry flag.
- **Category:** assumption
- **Disposition:** Accept.
- **Applied to:** phase-01 (Requirement 4, Step 8, Success Criteria 3); whether fail-closed configuration stays in this plan goes to the validation interview

## Finding 7: Completion-check evidence is weak and tamperable
- **Severity:** High
- **Location:** Phase 4, Requirements 1–2, Architecture
- **Flaw:** "Runner name and exit 0" is satisfied by a no-op test script or an empty selection; the state file is writable by the agent; the observer is fail-open and may be skipped; cap and default were undecided.
- **Failure scenario:** The model runs one trivial passing command and the check releases; the goal reads as met while work is unverified.
- **Evidence:** "Match runner name and exit 0 only; negative unit tests".
- **Suggested fix:** Describe the check as advisory; negative tests; settle default and cap before Phase 4.
- **Category:** risk
- **Disposition:** Accept.
- **Applied to:** phase-04 (Non-Functional, Test Gap Matrix, Success Criteria 1, Risk); default and cap go to the validation interview

## Finding 8: Phase 2 is under-estimated and too large for one review
- **Severity:** High
- **Location:** Phase 2, Deep Phase Map, effort
- **Flaw:** A new parser, about 1,860 lines of Rust removed, 50 affected test files, a hook-corpus re-record and upgrade tests on three runtimes in 3 days and one pull request.
- **Failure scenario:** The phase stalls on recording fallout while every later phase waits.
- **Evidence:** "Gate code in `crates/` is about 1,860 lines".
- **Suggested fix:** Split 2a (hooks, bundles, manifests, upgrade tests) and 2b (CLI, recordings); re-estimate.
- **Category:** timeline
- **Disposition:** Accept — alias resolution is kept: one confirmed evasion is a git alias.
- **Applied to:** phase-02 (Overview, effort 6d, Risk)

## Finding 9: Model-fit criteria go beyond gate-text removal
- **Severity:** High
- **Location:** Phase 3, Requirement 1 (A3, A4, A6, A7, A8)
- **Flaw:** De-emphasis, de-duplication, tool grants and model pins change behaviour under a gate-removal label.
- **Failure scenario:** A behaviour regression is attributed to gate removal and cannot be isolated.
- **Evidence:** "resolve tool grants and model pins per the validation interview answers".
- **Suggested fix:** Reviewer proposed cutting them to the skills plan.
- **Category:** scope
- **Disposition:** Accept in the maintainer's chosen form — the cut would reverse a locked decision (audit rules and agents for model fit); maintainer chose to keep the criteria as a separate pull request.
- **Applied to:** phase-03 (Requirement 1, pull request 3d, Risk), plan.md (User-Confirmed Decisions)

## Finding 10: Phase 4 carries fixes unrelated to gate removal
- **Severity:** High
- **Location:** Phase 4, Requirements 4–8
- **Flaw:** Density, budget, scanner, dead references, retirements and privacy changes had no plan-level criterion and sat in one pull request with the completion check.
- **Failure scenario:** A privacy false positive ships for reasons unrelated to the phase's purpose and is hard to bisect.
- **Evidence:** plan.md Acceptance Criteria listed nothing for these items.
- **Suggested fix:** Reviewer proposed deferring them.
- **Category:** scope
- **Disposition:** Accept in the maintainer's chosen form — the items are part of the confirmed HOLD scope; maintainer chose to keep them as three pull requests.
- **Applied to:** phase-04 (Overview, effort 3d), plan.md (User-Confirmed Decisions)

## Finding 11: The `doctor` home-directory scan can leak secrets and ingest untrusted text
- **Severity:** High
- **Location:** Phase 5, Non-Functional, Security Considerations
- **Flaw:** Hook commands were "printed as registered"; settings files hold tokens; names and frontmatter from other toolkits were printed unescaped; no symlink or size policy.
- **Failure scenario:** A token inside a foreign hook command lands in `doctor --json` and is pasted into an issue; a description carries control characters or injected text.
- **Evidence:** "Hook commands are printed as registered".
- **Suggested fix:** Executable name only; redaction; no symlink following; caps; strip control characters; opt-in plugin scan; fixtures.
- **Category:** risk
- **Disposition:** Accept.
- **Applied to:** phase-05 (Requirement 2, Non-Functional, Step 5, Success Criteria 6, Risk)

## Finding 12: The Cursor kill switch can be set by the agent and disables the Cursor guards
- **Severity:** High
- **Location:** Phase 1, Non-Functional; Phase 5, Requirement 5; plan.md: Autonomy Boundaries
- **Flaw:** The switch is an env var or a project flag file; the flag file is agent-writable; Phase 5 only reports it.
- **Failure scenario:** Injected text makes the agent write the flag file; the privacy read gate on Cursor stops blocking.
- **Evidence:** "clears the Cursor kill switch (env var and state flag file)".
- **Suggested fix:** Decide before Phase 2: env-only, privacy ignores it, or remove.
- **Category:** architecture
- **Disposition:** Accept as an open decision — changes a `privacy-block` decision, which the plan marks ask-first.
- **Applied to:** validation interview; phase-05 (weakened row reports it)

## Finding 13: Acceptance criteria would not catch a silent weakening, and docs could overstate enforcement
- **Severity:** High
- **Location:** plan.md: Acceptance Criteria; Phase 1 and Phase 3 Success Criteria
- **Flaw:** Criteria proved a few positive cases and a phrase count. Nothing fixed the number of guard cases or blocked patterns; one criterion was already true; none covered upgrade retirement or the completion check; "host permission prompt" was presented as a guarantee.
- **Failure scenario:** A refactor drops a privacy rule and every criterion stays green; README says pushes are protected on hosts running in auto-approve.
- **Evidence:** "`git ls-files tasks .meowkit` lists only the kit's own packaging files" (already true); "the text says so".
- **Suggested fix:** Case manifest with fixed counts; blocked-pattern tables unchanged; per-runtime enforcement matrix as the only doc source; real criteria for upgrade and completion check.
- **Category:** cross-cutting
- **Disposition:** Accept.
- **Applied to:** phase-01 (Requirement 5, Success Criteria 5), phase-03 (Requirement 5, Success Criteria 6), plan.md (Acceptance Criteria), phase-05 (Success Criteria 5)

## Finding 14: Privacy-block changes added exclusions without bypass or parity cases
- **Severity:** Medium
- **Location:** Phase 4, Requirement 5
- **Flaw:** Two exclusions and four names were tested as listed; near-miss names, traversal, symlinks and case variants were not; the three runtimes were not shown to decide alike.
- **Failure scenario:** A near-miss of an excluded name passes on one runtime and not another.
- **Evidence:** "four new privacy names on three runtimes".
- **Suggested fix:** Anchored basename matching after normalisation; one parity corpus across three runtimes.
- **Category:** cross-cutting
- **Disposition:** Accept.
- **Applied to:** phase-04 (Requirement 5, Success Criteria 2, Risk)

## Finding 15: Coexistence rows assumed host semantics that are not verified
- **Severity:** Medium
- **Location:** Phase 5, Requirements 1, 4
- **Flaw:** Which copy a host uses on a name collision and how each host budgets skill listings were stated as known; the threshold had no default; scan scope was open.
- **Failure scenario:** The row tells a user the project copy wins when the host does otherwise.
- **Evidence:** "with which scope the host uses"; "configurable threshold".
- **Suggested fix:** Label precedence as documented and unverified; settle scan scope before implementation.
- **Category:** assumption
- **Disposition:** Accept — the listing row stays (maintainer-confirmed); plugin scanning becomes opt-in.
- **Applied to:** phase-05 (Requirement 1, Non-Functional, Risk)

---

## Cross-Persona Blind Spot Pass

**Promoted to findings:** 1 — upgrade and migration for existing users (Finding 5, `Category: cross-cutting`). Independently noted by Assumption Destroyer and Scope/Complexity Critic: 'no phase covers the migration communication (changelog, upgrade notes, deprecation of the `plan approve` and `validate --gates` verbs…)', 'The upgrade path for already-installed users … has a one-line mitigation and no rollback story'.
**Noted concerns (single-persona):** 1

| Persona | Blind spot |
|---------|------------|
| Assumption Destroyer | Migration communication to existing users: changelog, upgrade notes, deprecation of removed verbs |
| Scope/Complexity Critic | Upgrade path for already-installed users: stale registrations, hand-edited settings, no rollback story |
| Security Adversary | Release and distribution integrity: who can alter the install artefact and how an installed hook tree is verified against what shipped |

### Noted Concerns (single-persona observations)

- **Security Adversary:** release and distribution integrity across three hand-maintained bundle trees — _not promoted; no convergent second voice_. Partly covered by the Phase 5 integrity row; release signing stays out of scope.

## Merged or dropped raw findings

- "Phase 1 does work no later phase needs" — not applied: Phase 2 edits the Cursor tool hook and Phase 4 the privacy lib, so Cursor cases are needed; probes stay in Phase 1 because they select designs.
- "Total effort unrealistic" — merged into Findings 1 and 8; total re-estimated at 23 days.
- "Plan directory move" — merged into Finding 13.

### Pending Sweep Edits
- [APPLIED] phase-05-coexistence-report-in-doctor.md L96: "`git ls-files tasks` check" → "source path gone, destination exists"
- [APPLIED] phase-03-gate-free-model-fit-instructions.md L170: "Human approval for push, merge and force moves to the host permission prompt; the text says so." → "Approval … is left to the host permission prompt where the host is set to ask; the enforcement matrix marks it advisory."
- [APPLIED] phase-02-remove-gate-mechanisms-standalone-ship-check.md L113: "start only after this phase merges" → "start once this phase is on the integration branch"

### Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-01-guard-self-test-and-host-probes.md, phase-02-remove-gate-mechanisms-standalone-ship-check.md, phase-03-gate-free-model-fit-instructions.md, phase-04-output-validation-without-gates.md, phase-05-coexistence-report-in-doctor.md, red-team-findings.md
- Decision deltas checked: 17
- Reconciled stale references: 3
- Unresolved contradictions: 0
- Ran at: 2026-11-15T11:32:25+07:00

### Mutation Log (kept here: plan.md is capped at 80 lines by the structural check)

- [2026-11-15T11:32:25+07:00] RECONCILE phase-05: "`git ls-files tasks` check" → "source path gone, destination exists" via sweep. Reason: red-team finding accepted; stale reference reconciled.
- [2026-11-15T11:32:25+07:00] RECONCILE phase-03: host-permission-prompt claim → advisory wording via sweep. Reason: red-team finding accepted; stale reference reconciled.
- [2026-11-15T11:32:25+07:00] RECONCILE phase-02: "after this phase merges" → "on the integration branch" via sweep. Reason: red-team finding accepted; stale reference reconciled.
- [2026-11-15T12:08:18+07:00] INSERT phase-05: row `coexistence: cross-runtime load`; phase-02: ship check runs once per command; phase-01: dual-install case. Reason: Cursor loads Claude Code hooks, skills and agents by default (runtime-docs-triage C1).
- [2026-11-15T12:08:18+07:00] INSERT phase-04: edits are read from the working tree at stop time instead of an `Edit|Write` hook. Reason: that hook does not run for shell-written files (C2).
- [2026-11-15T12:08:18+07:00] INSERT phase-04: Codex wording corrected — the host has a Stop hook; the bundle does not carry the completion rule. Reason: plan text was wrong (C3).
- [2026-11-15T12:08:18+07:00] INSERT phase-05: `checks: weakened` also reports host settings that stop kit hooks; phase-03: matrix lists installed-but-not-running states. Reason: C4.
- [2026-11-15T12:09:59+07:00] INSERT phase-04: completion rule registered as a Stop hook in the Codex bundle. Reason: maintainer chose three-runtime parity at re-approval.
