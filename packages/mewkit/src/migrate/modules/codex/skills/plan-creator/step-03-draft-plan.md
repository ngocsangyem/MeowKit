# Step 3: Draft Plan

Write plan.md overview + phase files. Integrate research findings into plan content.

## Instructions

If `intake_packet_path` is set (not `none`): after creating the plan directory,
move the packet to `{plan_dir}/research/plan-intake-packet.md` and read it FIRST —
before research reports. Cite it like any research report.

### 3a. Create Plan Directory

```
tasks/plans/YYMMDD-{slug}/
├── plan.md
├── research/          (if research reports exist)
└── phase-XX-name.md   (hard/deep/parallel/two mode)
```

### 3b. Write plan.md (Overview, ≤80 Lines)

Use this structure:

```yaml
---
title: "{Outcome-focused title}"
type: {feature | bug-fix | refactor | security}
status: draft
priority: {critical | high | medium | low}
effort: {xs | s | m | l | xl}
created: {YYMMDD}
model: {workflow_model from step-00}
blockedBy: []
blocks: []
---
```

```markdown
# {Title}

## Goal
{One sentence: what done looks like, not what to do}

## Context
{2-5 bullets: current state, problem, why this task exists}
{Include "Prior learnings:" if memory had relevant patterns}

## Phases

| # | Phase | Status | Effort | Depends On |
|---|-------|--------|--------|------------|
| 1 | [Name](phase-01-name.md) | Pending | Xh | — |
| 2 | [Name](phase-02-name.md) | Pending | Xh | Phase 1 |

## Key Deliverables
{numbered list}

## Constraints
{imperative: "Do NOT...", "MUST preserve..."}

## Risk Assessment
| Risk | L | I | Mitigation |
```

#### Conditional: `## Autonomy Boundaries` (long-horizon plans only)

Add a `## Autonomy Boundaries` section to plan.md **only** when the run is long-horizon — i.e. `planning_mode ∈ {hard, deep, parallel, product-level}` OR phase-count ≥ 3 OR scale-routing returned `level=high`. For fast / trivial / single-phase plans, OMIT this section entirely (it would be permanent dead weight on the high-frequency path).

WHY: across a multi-session or autonomous run, the only signals are global hard-stops (stop) or nothing (proceed). That binary causes both over-asking (interrupting a long run for trivia) and over-reach (silently making a reversible-but-significant choice). A persistent three-tier block, carried in the plan so it survives a cold-start resume, gives the executor a middle tier.

This block is **advisory** and carries only the **extra latitude specific to THIS task** — a delta over the always-on rules, NOT a restatement of them. Derive each item from this task's risk surface; do NOT copy generic defaults (running tests, naming, refactor-in-owned-files, schema-change escalation, budget tier, out-of-scope files) — those already live in the baseline rules and restating them duplicates rules and invites drift. Keep it short (the ≤80-line plan.md budget). The user tunes it at Gate 1.

```markdown
## Autonomy Boundaries

Baseline rules (security, gates, tests, naming, scope, budget) always apply; below is only the extra per-task latitude for this plan.

- **Always (autonomous):** {reversible, in-scope choices the executor may make without asking — e.g. "pick the internal helper name", "choose the test fixture layout"}
- **Ask first:** {reversible-but-significant choices to surface before acting — e.g. "swap the charting lib", "change the public API response shape", "add a new top-level route"}
- **Never:** see `.claude/rules/security-rules.md` and `.claude/rules/gate-rules.md` (hard stops — not restated here).
```

#### Conditional: `## User-Confirmed Decisions` (intake packet only)

If `intake_packet_path` is set and the packet's Requirements block lists user-confirmed
decisions: copy them into plan.md as a `## User-Confirmed Decisions` section, each item
marked `locked: user-confirmed`. These are decisions a human already made upstream —
step-05 red-team must escalate proposed cuts to the user, never silently remove them.

**Fast mode:** Write plan.md with Goal, Context, Scope, Constraints, Technical Approach, ACs, Agent State. NO phase files. NO Autonomy Boundaries block. Use `assets/plan-template.md` format.

### 3b'. Solution Design Checklist (Hard Mode Only)

Before writing phase files, read `references/solution-design-checklist.md`. Use it as a checklist when writing Architecture, Risk Assessment, and Security Considerations sections. Not every item applies — skip irrelevant items, but explicitly consider each dimension.

### 3c. Write Phase Files (Hard/Deep/Parallel/Two Mode)

### 3c.0. Frontmatter (Required)

Every phase file MUST begin with a YAML frontmatter block. See `references/phase-template.md` for schema.

Mapping rules:
- `phase`: integer matching filename (`phase-01-foo.md` → `phase: 1`)
- `title`: same as `# Phase N: {Name}` heading minus the `Phase N:` prefix
- `status`: ALWAYS `pending` at creation. NEVER write `completed`. NEVER write `unknown`/`draft`/`done` (not in parser union).
- `priority`: from priority assignment (default `P2`)
- `effort`: from effort estimate (e.g., `~1.75h`, `2h`, `?`)
- `dependencies`: integer array from "Depends On" column. `Phase 1, Phase 2` → `[1, 2]`. `—` → `[]`.

The Overview block markdown still includes `**Priority:**`, `**Effort:**`, `**Status:**`, `**Depends on:**` as a HUMAN-READABLE MIRROR. Frontmatter is the machine source of truth; cook's sync-back regenerates the mirror.

Each phase file MUST have these 12 sections (after the frontmatter block):

1. **Context Links** — links to research reports, related files, docs
2. **Overview** — priority, status, effort, description
3. **Key Insights** — findings from research (cite source: `from: research/researcher-01-report.md`)
   - Traceability rule: `from:` applies to Key Insights, Risks, Requirements, and Constraints. Valid values: a path (intake packet / research report / scout output / external artifact) or the tag `[ASSUMPTION]`.
4. **Requirements** — functional + non-functional
5. **Architecture** — design, data flow, component interaction
6. **Related Code Files** — files to create, modify, read
7. **Implementation Steps** — numbered, specific, file-referenced
8. **Todo List** — checkboxes for tracking
9. **Success Criteria** — binary pass/fail checks
10. **Risk Assessment** — table: risk, likelihood, impact, mitigation
11. **Security Considerations** — auth, data protection, injection
12. **Next Steps** — dependencies, follow-up tasks

See `references/phase-template.md` for the full template.

### 3c'. TDD Sections (Conditional: `tdd_mode = true`)

If `tdd_mode = true`, follow `references/tdd-mode.md`. Add optional frontmatter fields `tdd: true` and `regression_gate: "{command}"` when known, and append these 4 sections after "Implementation Steps" in each phase file:

13. **Tests Before** — failing tests to write BEFORE implementation; for refactors, capture current behavior first
14. **Protected Change** — code changes protected by the tests above
15. **Tests After** — integration/regression tests to add after refactoring (cross-component, edge cases)
16. **Regression Gate** — specific test commands to verify no regressions (`npm test`, `pytest -x`, etc.)

These sections are ONLY added when `--tdd` flag is set or `MEOWKIT_TDD=1` env var is active. Phase files without TDD mode retain the standard 12-section template.

### 3c''. Design Evidence Packet Consumption (Conditional)

If a design evidence packet path (e.g. `figma-evidence-packet/v1` from `mk:figma`) is present
in the invocation, intake packet, or task description: read
`references/design-evidence-consumption.md` and apply it while drafting. Do NOT call the
design source's tools (e.g. Figma MCP) or re-parse raw design JSON — consume packet fields.

- Cite packet fields in Key Insights (reference the packet path, not raw JSON).
- Derive acceptance criteria from `validation_contract.required_viewports` / `required_states`.
- Derive validation-matrix items from critical prototype actions only (not trivial transitions).
- Adjudicate flow conflicts per the precedence order; record a decision-ledger row for each.
- For unresolved high-risk flow ambiguity, set the additive optional `blocked_on:` frontmatter
  field on ONLY the affected phase (list of `"<ledger-id>: <question>"`); leave `status:`
  unchanged. Block only affected phases, never the whole plan.

Skip entirely when no packet path is present.

### 3d. Phase Splitting Rules

**Default to vertical slices.** For a feature-shaped task, each phase should deliver ONE thin end-to-end working path — the slice cuts through DB + API + UI as needed — so the system is runnable / demoable after every phase. Horizontal layering (all DB, then all API, then all UI) leaves the system non-functional until the last phase, which is poor for checkpointing, demo, and recovery on a long run.

**Decision rule:** feature-shaped task → vertical slice per phase; pure foundation layer → horizontal phase.

- **Foundation layers** → own horizontal phase, but ONLY for genuinely shared groundwork no single slice owns: migrations, shared types, env/config setup.
- **Setup/infrastructure** → own phase (env, deps, config) — runs first.
- **Vertical feature slice** → own phase (one end-to-end path: its DB + API + UI together), NOT one phase per layer.
- **Testing** → own phase only if substantial test work remains beyond each slice's own tests.
- **Documentation** → own phase (if docs impact = major).
- **Min 2 phases** in hard mode.
- **Max 7 phases** (beyond that, decompose the task).

**`--parallel` precedence:** when `planning_mode = parallel`, file-ownership grouping governs decomposition — a vertical slice spans DB + API + UI and overlaps other slices' files, which fights zero-overlap parallelism. Vertical-slice guidance applies to the DEFAULT / sequential decomposition; ownership-based grouping wins in parallel mode.

**Break-down triggers** (heuristics, not hard rules; `Max 7` is the ceiling):
- "and" in a phase title (e.g. "Auth and profile") → split into two phases.
- Two clearly separable deliverables in one phase → split.

Do NOT split on acceptance-criteria count — a real end-to-end slice legitimately carries several ACs; counting them re-introduces the horizontal fragmentation this default exists to prevent.

### 3e. Research Integration

For each phase file, populate "Key Insights" from research reports:
1. Read research report file paths from step-01
2. For each insight relevant to this phase, cite: `(from: research/researcher-01-topic.md)`
3. For "Technical Approach" in plan.md: synthesize researcher recommendations

### 3f. Cross-Plan Dependency Detection

If step-02 found existing plans with overlapping scope:
1. Classify: new plan blocks existing? new plan needs existing? mutual?
2. Set `blockedBy` / `blocks` in both plan.md frontmatter
3. If ambiguous: note for user in step-06 validation interview

### 3g. Research Link Verification (Hard Mode Only)

After writing phase files, verify research integration:

For each phase file:
1. Check: does `## Context Links` contain at least one `research/` link?
2. If `{plan-dir}/research/` has reports but Context Links is missing them:
   - Add link to most relevant report (match by keyword)
   - Print: `"Fixed: {phase-file} now links to research/{report}"`
3. If no research reports exist (fast mode): skip this check.

### 3h. Per-Phase Scouting (Conditional: `planning_mode = deep`)

After writing all phase files (section 3c), follow `references/deep-mode.md` and run targeted scouting for each phase:

1. For each phase file, read its `## Related Code Files` section
2. Cross-check those paths against the step-02 deep scope map; if the phase paths are guesses, record uncertainty instead of widening the scan
3. Invoke `mk:scout` on each directory set (max 3 tool calls per phase, max 7 phases)
4. Inject scout results into the phase file:
   - Add `## Deep Phase Map` with **File Inventory**, **Test Gap Matrix**, **Interface Checklist**, and **Dependency Map**
5. Print: `"Deep scan: {N} phases scouted, {M} files inventoried"`

**Bounds:** max 3 tool calls per phase scout, max 7 phases scouted total, max 12 inventory rows per phase. If scout exceeds bounds, prioritize phases with highest risk or most file overlap.

**Skip if:** `planning_mode` is not `deep`.

### 3i. Parallel Mode (conditional: `planning_mode = parallel`)

After writing all phase files (section 3c), analyze ownership boundaries:

1. For each phase file, identify which files/dirs it modifies → assign `ownership` globs.
2. Group phases with zero file overlap into parallel groups (max 3 groups).
3. Setup/infrastructure phase → Group 0 (always sequential, runs first).
4. Integration/test/docs phase → final group (always sequential, runs last).
5. Add `ownership` and `parallel_group` fields to the SAME frontmatter block (alongside `phase`, `title`, `status`, `priority`, `effort`, `dependencies`). Place at the bottom of the block for readability.
6. Append `## Execution Strategy` section to plan.md after the Phases table:

```markdown
## Execution Strategy

| Group | Phases | Parallel? | Ownership |
|-------|--------|-----------|-----------|
| Setup | 1 | Sequential (first) | {infra globs} |
| A | 2, 3 | Yes | {phase globs} |
| B | 4 | Sequential (after A) | tests/*, docs/* |
```

See `references/parallel-mode.md` for full rules and templates.

### 3j. Two-Approach Mode (conditional: `planning_mode = two`)

Instead of writing plan.md and phase files directly:

1. Generate `{plan_dir}/plan-approach-a.md` and `{plan_dir}/plan-approach-b.md` using the approach template from `references/two-approach-mode.md`. Both approach files get frontmatter with `status: pending` (not `draft` — `draft` is not in the parser union and would normalize to `unknown`). The "selected vs archived" distinction is tracked in `trade-off-matrix.md`.
2. Generate `{plan_dir}/trade-off-matrix.md` comparing both approaches.
3. **Do NOT generate plan.md or phase-XX files yet** — deferred until user selects approach at step-04.
4. Create `{plan_dir}/archived/` directory (empty, ready for non-selected approach).

Print: `"Two approaches drafted. User selects at step-04 before red-team."`

### 3V. Visual Artifact Generation (gated: `html_mode == true`)

Skip when `html_mode == false`. Otherwise, AFTER the Markdown draft, generate
the coverage ledger + `{plan_dir}/visual-plan/plan.json` (schema `visual-plan/v1`)
from `ui_evidence` (step-02; fast mode gathers a minimal inline inventory here).

Generation contract (one frame per state, real labels, stable ids, adjacent-transition
connectors only, mechanics in `documentBlocks`, `.wf-*` semantic HTML only, coverage
closes every state via one mode) + a compact valid example artifact:
`references/visual-plan-integration.md` §3. After writing, run
`mewkit visual-plan rehash {plan_dir}` once to stamp source hashes (do NOT hand-write
`source.planHash`/`phaseHashes`).

## Output

- `plan_dir` — absolute path to the created plan directory
- `visual-plan/plan.json` written when `html_mode == true` (else no visual metadata)
- Print: `"Plan: {plan_dir}/plan.md ({N} phases)"` (parallel/hard mode)
- Print: `"Two approaches drafted. User selects at step-04 before red-team."` (two mode)

## Next

Read and follow `step-04-semantic-checks.md`
