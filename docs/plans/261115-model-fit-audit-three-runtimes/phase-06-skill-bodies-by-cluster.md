---
phase: 6
title: "Skill bodies by cluster, three trees per PR"
status: done
priority: P1
effort: "10d"
dependencies: [2, 5]
---

# Phase 6: Skill bodies by cluster, three trees per PR

## Context Links

- [Baseline and vendor sources](research/baseline-and-vendor-sources.md) — N3, N7, N8, N10, N12; §3 all rows
- `docs/maintainer/instruction-audit-criteria.md` (A1–A14 after Phase 1)
- `docs/research/meowkit-evolution-2611/05-skill-agent-rule-hook-audit.md` §6(b) mechanical list, §6(c) clusters, C-20
- `docs/research/meowkit-evolution-2611/findings/D02-skills-inventory.csv` (one row per skill)

## Overview

- **Priority:** P1
- **Status:** Done
- **Effort:** 10d
- **Depends on:** Phases 2, 5
- **Description:** Audit every skill body and its references on three runtimes against the criteria, cluster by cluster. Each cluster is one pull request that edits `.claude/` first and ports the same change to Codex and Cursor in the same PR, so the trees never drift between merges.

## Key Insights

- Host-foreign syntax sits in 8 workflow skills (`subagent_type=` 19 Codex / 17 Cursor files; `TodoWrite` 2 Codex) (from: research/baseline-and-vendor-sources.md §1). Host-neutral wording ("delegate to the `reviewer` agent with this brief") reads correctly on all three hosts; each host's own delegation tool does the rest.
- Standing delegate instructions in 30/21/19 files and re-verify phrasing in 13 per tree (N7): Opus 5 and Fable 5.2 guidance says these cause over-delegation and over-verification (§3).
- 45/34/34 references over 100 lines lack a contents list (N8); no SKILL.md is over 500 lines (N9), so disclosure work is in references, not SKILL.md size.
- Mechanical leftovers from the research audit still present: 8 lines point at `review/TODOS-format.md` or `lib/system-deps-registry.ts`, which do not exist (`rg` 2026-11-15). `lazy-agent-loader` and the `*.md.tmp` files are already gone.
- Contract tests pin SKILL.md text for at least 16 skills (audit §6(f)); rewrites must update those pins in the same PR.
- The research audit graded most skills JUDGEMENT with no outcome data; this phase changes wording and structure only, never removes a skill on judgement.

## Requirements

### Functional
1. Per skill, apply: A1–A14; absolutes with scope and reason; delegate lines carry a condition; no re-verify restatement; host-neutral delegation and task-list wording in shared text, host syntax only where one host's file needs it; one term per concept; references one level deep with a contents list over 100 lines; no time-bound text outside an "old patterns" note.
2. Clusters, one PR each (order is the merge order):
   - **6a Workflow core** (12): cook, plan-creator, autobuild, review, fix, ship, agent-detector, planning-engine, scout, trace-analyze, orchestrate, workflow-orchestrator — holds all host-foreign syntax.
   - **6b Plan, review and verify** (~20): validate-plan, plan-ceo-review, sprint-contract, evaluate, verify, simplify, qa, qa-manual, rubric, review-pr, respond-pr, investigate, build-fix, testing, lint-and-validate, intake, breakdown, nyquist, retro, document-release.
   - **6c Think and context** (~16): brainstorming, office-hours, party, advise, elicit, grill, decision-framework, problem-solving, sequential-thinking, context-engineering, context-audit, session-continuation, memory, help, delegate, team-config.
   - **6d Domain and framework** (~35): angular, vue*, react-patterns, typescript, database, backend-development, api-design-principles, frontend-design, ui-design-system, devops, and the remaining build and tool skills.
   - **6e Atlassian** (23): jira and confluence hubs and leaves; near-template prose, so one pass with a shared template.
3. Skills present only on Claude Code (`arch`, `breakdown`, `delegate`, `status`) and only on Codex (`rule-advice-supervision`) are listed for the user: port, or record as host-specific in the parity file (Phase 7).
4. Dead references fixed; `check-skill-cross-refs.sh` taught the `.claude/skills/<x>/…` form it misses (audit C-03).
5. Each PR records the per-cluster metric delta (emphatic, A12, A14 counts, bytes) in its description.

### Non-Functional
- No skill or reference deleted without the user's OK; skill names unchanged.
- Skill contract tests, `check-skills-portable.cjs`, `check-skill-cross-refs.sh` green in every PR.

## Architecture

```
for cluster in 6a..6e:
  edit .claude/skills/<cluster> → diff per file → port to codex .agents/skills/mk-<x>
                                             → port to cursor .cursor/skills/mk-<x>
  checker (3 trees) + contract tests + cross-refs + portable → PR → integration branch
```

## Related Code Files

### Files to Create
- None (a shared delegation phrase lives in criteria doc as an example, not a new file)

### Files to Modify
- `.claude/skills/**` (127 skills), `kit/bundles/codex/root/.agents/skills/**` (124), `kit/bundles/cursor/root/.cursor/skills/**` (123)
- `tests/*-skill-contract.test.sh` pins touched by a rewrite
- `scripts/check-skill-cross-refs.sh` — path form

### Files to Read (Context)
- `findings/D02-skills-inventory.csv` — prior per-skill notes
- `scripts/check-skills-portable.cjs` — classes of `.claude/` reference

## Deep Phase Map

### File Inventory

| Action | Path | Reason | Test Impact |
|---|---|---|---|
| Modify | 6a skills, 3 trees | host syntax, delegation, verify lines | cook, fix, help, workflow-orchestrator contract tests |
| Modify | 6b skills, 3 trees | absolutes, verify restatement | validate-plan, investigate, build-fix, document-release, rubric tests |
| Modify | 6c skills, 3 trees | absolutes, disclosure | sequential-thinking, prompt-enhancer tests |
| Modify | 6d skills, 3 trees | disclosure, contents lists | none known |
| Modify | 6e skills, 3 trees | template prose | story-sizer tests |
| Modify | `scripts/check-skill-cross-refs.sh` | missed path form | `tests/skill-cross-refs.test.sh` |

### Test Gap Matrix

| Behavior | Existing Coverage | Missing Coverage | Priority |
|---|---|---|---|
| Body text has no host-foreign syntax | Rust check on installed output only | checker A9 on source (Phase 1) | High |
| Rewrites keep skill behaviour | contract tests pin text, not behaviour | optional with/without runs (audit C-20), ask first | Medium |

### Interface Checklist

- Script paths and arguments a skill tells the model to run; `${CLAUDE_SKILL_DIR}` use; output file locations other skills read (verdicts, reports, plan layout).

### Dependency Map

- 6a first (other skills point at cook, review, plan-creator); 6e last (independent); each later cluster rebases on the earlier merge.

## Implementation Steps

1. 6a: replace host syntax with host-neutral delegation; remove standing delegate and re-verify lines; absolutes; references; port; update contract pins.
2. 6b–6d: same checklist per cluster; port; update pins.
3. 6e: write one shared leaf template, apply to 21 leaves and 2 hubs; port.
4. Fix dead references and the cross-ref checker in 6b (ship, plan-ceo-review) and 6d (web-to-markdown); jira ones in 6e.
5. Ask the user about host-only skills; record the answer for Phase 7.
6. After each PR, run the checker with `--metrics` and paste the delta.

## Todo List

- [x] 6a workflow core, three trees
- [x] 6b plan, review and verify, three trees
- [x] 6c think and context, three trees
- [x] 6d domain and framework, three trees
- [x] 6e Atlassian, three trees 
- [x] Dead references and cross-ref checker fixed (workflow-* helpers ported in Phase 7)
- [x] Host-only skills decided (2026-11-16: record as host-specific; no ports)

## Success Criteria

1. `node scripts/check-instruction-criteria.cjs` exits 0 without a baseline file for A9–A13, and A12/A14 counts are at or below the Phase 1 baseline on every tree.
2. `rg -l 'subagent_type|TodoWrite' kit/bundles` prints nothing.
3. `bash scripts/check-skill-cross-refs.sh` and `bash tests/skill-cross-refs.test.sh` exit 0 with the new path form checked.
4. All `tests/*-skill-contract.test.sh`, `node scripts/check-skills-portable.cjs`, `npm test` exit 0 after each cluster.

## Risk Assessment

| Risk | L | I | Mitigation |
|------|---|---|------------|
| 10-day sweep is too large to review | H | H | Five PRs, each ≤ ~40 skills × 3 trees; mechanical changes in separate commits from wording |
| Wording change alters a workflow step | M | M | Steps, commands and output paths are an interface; diff review checks them |
| A cluster merges while another trees' port lags | M | M | Port in the same PR; Phase 7 parity check |

## Security Considerations

- `chrome-profile` (Rule of Two, audit §6e) and other skills that handle untrusted input keep their confirmation and boundary text; softening never applies to them.

## Next Steps

- Phase 7 adds the parity check and the after-measurement.

## Progress

**2026-11-16, 6a and the bundle-wide mechanical pass (committed b1afb9c9):**

- Host-only skills: the user chose to record `arch`, `breakdown`, `delegate`, `status` (Claude Code) and `rule-advice-supervision` (Codex) as host-specific in the Phase 7 parity file; no ports.
- Mechanical, all bundle files: `mk:x` → `mk-x` (3,684 names, 733 files); bundle skill paths missing the `mk-` prefix fixed (856, e.g. `.agents/skills/jira/scripts/jira-as.sh`, which the installer never creates: `crates/mewkit-adapters/src/codex/mod.rs:74`); pseudo-call `subagent_type=` → `agent=`; plan-mode wording without ExitPlanMode; a contents list on 101 references over 100 lines (three trees).
- Host syntax: remaining `subagent_type`, `Agent(...)`, `Task tool`, `TodoWrite`, `TaskCreate` rewritten host-neutral; Codex copies of five task-tracking files take the neutral Cursor text.
- 6a wording: Claude Code `Task(` → `Agent(` (the tool is `Agent`); stale "always use Task()" gotcha removed; PM delegation conditioned on `MEOWKIT_PM_AUTO`; gate wording left from the gate removal fixed; re-verify lines reworded; workflow-orchestrator contract pin moved to current wording (the test failed on main).
- Left by design: A12 "sends the reader to another file" in cook/fix/plan-creator/ship — they are the just-in-time rule loads and cross-skill pointers.

**2026-11-16, 6b (committed a62506b2):**

- Dead references: `TODOS-format.md` (never existed; the format is now inline), `system-deps-registry.ts` (now "mewkit setup reads …"), jira-fields scripts, and every bundle path that named a file the bundle does not ship: Codex took the Cursor wording line by line (workflow.yaml, rubric library, shared validation scripts, secret-scrub, jira env check); `setup-workflow` → `mewkit setup` in the bundles (it only runs `mewkit setup`).
- `check-skill-cross-refs.sh` now checks `.claude` references and both bundles (paths must exist in the bundle root; run-time files exempt); `skill-cross-refs.test.sh` seeds both failures.
- The bundle stand-in for AskUserQuestion ("stop and ask the user in chat", 533 places) rewritten to grammatical host-neutral wording.
- Shouted absolutes without a boundary softened in the shared protocol text and 6b skills; boundary rules kept (credentials, injection, data boundary, `any` ban).
- Not done, needs a decision: the bundles call `.codex/scripts/bin/workflow-{config,slug,review-log,repo-mode,diff-scope}` (~90 places) that ship only on Claude Code (`.claude/hooks/lib/`); the bundles also lack the rubric files, cook rule references and lint scripts. Port vs reword is a parity call (Phase 7).

**2026-11-16, 6c (committed d4aaf808):**

- The 16 skills were already light: 16 emphatic tokens, no host syntax in the bundles, no delegate or re-verify lines. `AskUserQuestion` stays in the Claude Code tree; the advise supervision NEVERs, delegate's injection guard and help's "security hooks are never skipped" guard boundaries and stay.
- Bundles: `/mk:[skill]` (help) and `mk:[skill]` (plan-creator) → `mk-[skill]`; context-audit "slash command" → "skill". The A10 check missed both forms; it now catches `/mk:x` and `mk:[…]` (new fixture).
- All trees: office-hours shouting softened ("ONE AT A TIME", "MANDATORY", "NOT optional", "Do NOT proceed" → reasoned wording); team-config integration-test line gives its reason instead of MUST; help, sequential-thinking, problem-solving, brainstorming `Do NOT` / `MUST` lowercased where they are not boundaries; office-hours phase2.5 got a contents list (H1-only file the script skipped).
- Delta: emphatic 551/469/437 → 547/465/433; A12 32/21/21 → 31/20/20; A14 unchanged.

**2026-11-16, 6d (committed 5149e1ec mechanical, 7ed26dbb wording):**

- Scope: the 55 skills not in 6a–6c or 6e (the plan estimated ~35).
- Mechanical, bundle-wide: 463 command spans read as prose (`` `the preview skill --explain <topic>` ``) → the host form (`$mk-preview …` on Codex, `/mk-preview …` on Cursor, per the research note); names with no bundle skill mapped as the Claude Code tree does (`plan` → `mk-plan-creator`, `budget` → `mewkit budget`, `confluence-setup` → guided setup in `mk-confluence`, `status` → the project-manager agent). 102 sibling-skill paths missing the `mk-` prefix (`../plan-creator/`) fixed. A10 now flags prose inside a command span (fixture added).
- Codex careful/freeze claimed a PreToolUse hook Codex does not register; they take the Cursor "configured hooks when present" wording.
- A12: bootstrap, preview and agent-browser references no longer send the reader to sibling references; each SKILL.md now names what loads together.
- A14: figma re-verify lines and the unconditioned status delegate reworded.
- Absolutes: bootstrap's MANDATORY/IMPORTANT/ACTION REQUIRED headings, preview's MANDATORY labels, typescript and worktree style ALWAYS lines given reasons; boundary rules kept (careful, cso, web-to-markdown, loop, pack, `any` ban, preview XSS and secret scrub, eval pass criteria).
- Delta: emphatic 547/465/433 → 521/439/407; A12 31/20/20 → 18/7/7; A14 4/3/3 → 1/1/1.
- Not fixed, parity: bundle rubric paths (`../../rubrics/schema.md`) and other unshipped files stay with the Phase 7 port-or-reword call.

**2026-11-16, 6e (uncommitted):**

- Leaves share one structure (Triggers, Examples, See also, Gotchas); no template drift. The 13 emphatic tokens per tree guard boundaries (CQL/JQL sanitizing, ID validation, PII placeholders, bulk dry-run, scout trust boundary) and stay.
- Bundle scripts (26 files): `ROOT="$(git rev-parse --show-toplevel):-$(pwd)}"` built a path like `/repo:-/cwd}`, so jira-as, confluence-as, fetch-workflow and adf-to-md could never find their binary or `.env` on Codex or Cursor; the two benchmark scripts had the same remnant. Fixed to `$(git rev-parse --show-toplevel 2>/dev/null || pwd)`. Script paths missing `mk-` (`$ROOT/.agents/skills/jira/scripts/jira-as.sh`) and `[mk:x]` log prefixes fixed.
- Text: confluence binary-name re-verify line, confluence-page and jira-relationships sibling-reference pointers (SKILL.md now lists the Mermaid rules), story-sizer cleanup hint.
- Delta: A12 18/7/7 → 16/5/5; A14 1/1/1 → 0/0/0; emphatic unchanged.
- Setup gap (user chose the Rust fix): `skill_dir` and `env_skills` now also find `.agents/skills/mk-<skill>` and `.cursor/skills/mk-<skill>` (Claude Code folder wins); `skill env` uses `skill_dir` for its existence check. Two tests added. `mewkit skill env --list` inside each bundle now lists confluence, jira, web-to-markdown. Setup builds no environment without `--skills`, so 68 lines on all three runtimes that said "run setup-workflow / `mewkit setup`" to install jira, confluence, multimodal or llms now say `mewkit skill env <skill>`; docs-finder (declares no environment) and `--system-deps` lines left.
