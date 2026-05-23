# Project Changelog

Significant features, fixes, security updates, and breaking changes shipped on top of MeowKit.

## 2026-05-23 — Cook skill workflow & context-engineering upgrade

**Scope:** `.claude/skills/cook/` + `.claude/skills/plan-creator/SKILL.md` + `.claude/skills/review/SKILL.md` + `.claude/skills/review/step-04-verdict.md` + `.claude/skills/brainstorming/references/anti-rationalization.md` + new `.claude/rules/anti-rationalization.md`. 7-phase upgrade per `plans/260523-1428-meowkit-cook-workflow-context-engineering-upgrade/plan.md`.

**Summary**

- **Runtime-neutrality** — replaced USD pricing on `--verify` / `--strict` modifier flags with `[LIGHT]` / `[HEAVY]` relative-cost labels; removed inner-harness Mermaid rendering preamble; reframed Phase 4.5 subagent column to `browser-automation subagent or HTTP verification tool`; softened `Task()` references to "inner harness's delegation surface".
- **Internal consistency** — renamed Phase 5 ship subagent from `git-manager via mk:ship` to `shipper via mk:ship` (shipper invokes git-manager internally); unified TDD column labels to `RED-strict` / `Plan-level` / `Skip` across cook SKILL.md, intent-detection.md, workflow-steps.md; split Phase 4.5 node in the SKILL.md Mermaid diagram into `--verify advisory` (no back-edge) + `--strict blocking` (FAIL back-edge to Phase 3); added validate-gate-1.sh non-auto advisory pre-check.
- **Token / noise deduplication** — created `.claude/rules/anti-rationalization.md` as the single source; cook SKILL.md retains a 1-row TDD-specific extension + callback; brainstorming retains its domain-specific table with a cross-link. Gate 2 absolutism callback now identical across cook/SKILL.md, intent-detection.md, workflow-steps.md (review-cycle.md preserved per plan Architecture). Cook SKILL.md Workflow Modes table demoted to 3 columns (canonical 6-col matrix in `references/intent-detection.md`). Gotchas ↔ failure-catalog cross-link added both directions.
- **Scout-first + exact-requirements gates** — new "Scout-First Contract (Phase 0)" and "Exact-Requirements Contract (Phase 1)" sections in cook SKILL.md. Plan-creator/SKILL.md gained a "Requirements Capture Contract" section enumerating the 5 dimensions. SKILL.md Mermaid diagram updated with `SP[Present scout summary to user]` node on the No branch of `Has plan?` and a `RQ{5 dims captured?}` decision loop on Phase 1. Skip path explicit on plan-path input. 3 new failure-catalog entries (skipped scout summary, vague clarifying questions, gate fired on plan-path input).
- **No-side-effects regression-options pattern** — new "Regression Recovery Options" subsection in `cook/references/review-cycle.md` (5-step procedure + 4 standard options). New "Side-Effect Signal" subsection in `review/SKILL.md` and authoring instructions in `review/step-04-verdict.md` defining the `Side Effects Detected: Yes` plaintext line + `## User Decision Addendum` block. `validate-gate-2.sh` now recognizes the signal — blocks Gate 2 when the signal is present AND no addendum follows. **Backward-compat: absence of the field is never a block signal.** 2 new tests in test-scripts.sh (verdict with signal + no addendum → exit 1; verdict with signal + addendum → exit 0). Test suite: 10/10 pass.
- **Subagent delegation template completeness** — `cook/references/subagent-patterns.md` gained a "Standard Delegation Skeleton" section listing the 9-field orchestration template once at the top; each per-phase template section (13 sections covering scout, researcher, planner, tester, developer, parallel developer, debugger researcher, reviewer, shipper, planner sync-back, documenter, analyst, ui-ux-designer) includes a `**Scope (role):** pass X / do NOT pass Y` line defining the isolation boundary per `orchestration-rules.md`. Ship section renamed from "Ship — Git Operations" to "Phase 5 Ship — Shipper" (subagent renamed from `git-manager` to `shipper` for consistency with the Phase 2 rename in cook SKILL.md and workflow-steps.md).

**Backward-compat note**

All phase changes are prose-only or additive. The new validate-gate-2.sh side-effect signal is positive-presence-only — absence of the field is never a block signal, so existing plans / verdicts / sessions created before this upgrade continue to work unchanged. No opt-out env var added (prose-only changes can't break in-flight sessions; the env var would have been maintenance overhead for no upside).

**Token-load delta (cook + references)**

- Pre-Phase-1 baseline: not captured (token-count snapshots started at end of Phase 4).
- Post-Phase-4 snapshot: 6944 words (after the scout-first + exact-requirements additions, before Phase 3 dedup).
- Post-Phase-7 final: 7599 words.

The net increase (+655 words from post-Phase-4) is dominated by the Phase 6 per-template Scope annotations (~370 words across 13 templates) and the Phase 5 Regression Recovery Options + Side-Effect Signal sections (~230 words). Cook SKILL.md itself dropped from 1964 → 1865 words (-5%) thanks to Phase 3's mode-table demotion and anti-rationalization migration to the shared rules file. JIT loading means references/*.md content is paid only when actively read.

**Migration**

No action required. New gates (scout-first, exact-requirements) apply only when starting from a fresh task description. Plan-path invocations skip both gates explicitly.

**Dead-weight audit cadence**

Per `.claude/rules/dead-weight-audit-rules.md` Rule 1, the audit MUST run on (1) new model release, (2) quarterly, (3) recurring no-value patterns, (4) user "feels heavy" reports. The next scheduled audit run will measure whether any of the new gates introduced in this upgrade have become dead weight on the then-current model tier. Calendar reminder: 2026-08-23 (next quarterly) or earlier on next model-tier upgrade.

**Verification**

- `bash .claude/skills/cook/scripts/test-scripts.sh` → 10/10 pass.
- `python3 .claude/scripts/check-docs-references.py` → no new cook regressions (one pre-existing memory/ error unchanged).
- Cook SKILL.md final: 218 lines (under the 500-line skill-authoring limit).
- Mermaid diagram: edge labels quoted (`|"--verify"|`, `|"--strict"|`) for spec-safe rendering across renderers.
