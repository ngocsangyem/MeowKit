# MeowKit Skill Authoring Guidelines

**Source consolidation**: Anthropic *Skill Authoring Best Practices* (Doc A) + Anthropic *Lessons from Building Claude Code: How We Use Skills* (Doc B).
**Audience**: Authors of `meow:*` skills under `.claude/skills/`.
**Ground rule**: This file derives from the two source docs only. No external extrapolation.

---

## 1. Document A summary — Skill Authoring Best Practices

**Core philosophy**: Concise, well-structured, tested skills that Claude discovers and uses effectively. Context window is a public good.

Key positions:
- **Concise is key.** Only metadata (name, description) is pre-loaded; SKILL.md loads on trigger; reference files load on demand. Once loaded, every token competes with everything else.
- **Default assumption**: Claude is already smart. Strip explanations Claude doesn't need.
- **Degrees of freedom** match task fragility:
  - HIGH (text instructions) → multiple valid approaches
  - MEDIUM (templates with parameters) → preferred pattern with variation
  - LOW (specific scripts, no params) → fragile, sequence-critical operations
  - Analogy: narrow bridge (low) vs open field (high)
- **Test with all target models** (Haiku/Sonnet/Opus differ in instruction need)
- **YAML frontmatter rules**: `name` ≤64 chars, lowercase + numbers + hyphens, no XML tags, no reserved words (`anthropic`, `claude`); `description` ≤1024 chars, non-empty, no XML tags
- **Naming**: prefer gerund form (`processing-pdfs`); avoid vague (`helper`, `utils`)
- **Description**: third person ("Processes Excel..."), includes what + when, key terms for discovery
- **Progressive disclosure**: SKILL.md = table of contents; bundled files load only when needed
- **SKILL.md body under 500 lines**
- **References one level deep** from SKILL.md (deep nesting → partial reads via `head -100`)
- **Reference files >100 lines need a TOC** at top
- **Workflows with copy-able checklists** for multi-step tasks
- **Feedback loops**: validator → fix → repeat
- **No time-sensitive info** in main flow; legacy goes in collapsed "old patterns" section
- **Consistent terminology** throughout
- **Templates**: strict ("ALWAYS use this") vs flexible ("sensible default")
- **Examples pattern**: provide input/output pairs when output style matters
- **Build evaluations BEFORE writing extensive docs**: identify gaps → write 3+ scenarios → measure baseline → write minimal instructions → iterate
- **Iterate with Claude**: Claude A authors, Claude B tests on real tasks; observe and refine
- **Observe navigation**: unexpected paths, missed connections, ignored files
- **Anti-patterns**: Windows-style paths (use forward slashes), offering too many options without a default
- **Scripts**: solve don't punt (handle errors), no voodoo constants (justify all numbers), prefer pre-made scripts over generation, make execute-vs-read intent clear
- **Visual analysis**: render to images when layout matters
- **Plan-validate-execute pattern**: produce structured plan file → script-validate → execute → verify
- **Package dependencies**: list explicitly; verify availability (claude.ai installs from PyPI/npm; API has no network)
- **MCP tool refs use `ServerName:tool_name`**
- **Don't assume tools installed**

Final checklist covers: core quality, code/scripts, testing across models.

---

## 2. Document B summary — Lessons from Building Claude Code

**Core philosophy**: Skills are folders, not just markdown. Folders can include scripts, assets, data, hooks, dynamic config. The interesting skills exploit this.

**9 skill categories** (use to spot gaps in your org):
1. Library & API Reference — explain libs/CLIs/SDKs with code snippets + gotchas
2. Product Verification — drive playwright/tmux/etc. with state assertions; "worth a week of an engineer's time"
3. Data Fetching & Analysis — connect to data/monitoring stacks with credentials, dashboard IDs
4. Business Process & Team Automation — collapse repetitive workflows; persist past results in log files
5. Code Scaffolding & Templates — boilerplate generators with composable scripts
6. Code Quality & Review — adversarial-review, code-style, testing-practices; can be wired to hooks/Actions
7. CI/CD & Deployment — babysit-pr, deploy-X with rollback, cherry-pick-prod
8. Runbooks — symptom → multi-tool investigation → structured report
9. Infrastructure Operations — destructive ops with guardrails

**Authoring tips**:
- **Don't state the obvious**: Claude knows coding defaults; focus on non-default knowledge (frontend-design example: avoid Inter font, purple gradients)
- **Build a Gotchas section**: highest-signal content; grow over time from observed failures
- **Use file system & progressive disclosure**: split refs (`references/api.md`), include templates in `assets/`
- **Avoid railroading**: too-prescriptive step lists hurt; "Cherry-pick onto a clean branch. Resolve conflicts preserving intent" beats step-by-step
- **Think through setup**: store user-specific config in `config.json`; agent asks via `AskUserQuestion` if unset
- **Description field is FOR THE MODEL**: it's a trigger description, not a human summary
- **Memory & data storage**: append-only logs, JSON, or SQLite; store in `${CLAUDE_PLUGIN_DATA}` (stable across upgrades, not skill dir which gets wiped)
- **Store scripts & generate code**: helper libraries (e.g., `lib/signups.py` with `fetch`, `by_referrer`, `by_landing_page`) let Claude compose new analysis scripts on the fly instead of reconstructing boilerplate
- **On-demand hooks**: skill-scoped hooks active only during skill use (e.g., `/careful` blocks `rm -rf` only when invoked)
- **Distribution**: check into `./.claude/skills/` (small teams, few repos) OR plugin marketplace (scaled orgs); checked-in skills add startup context cost
- **Marketplace governance**: organic discovery, sandbox first, PR to graduate; bad/redundant skills are easy to make → curate
- **Compose skills**: reference other skills by name; the model invokes them if installed (no native dep mgmt yet)
- **Measure skills**: PreToolUse hook logs invocations → spot popular vs under-triggering

**Tone**: "grab bag of useful tips that we've seen work" — not definitive. Most skills started as a few lines + one gotcha and grew with edge cases.

---

## 3. Common principles (intersection)

| Principle | Doc A framing | Doc B framing |
|---|---|---|
| Claude is smart, don't over-explain | "Default assumption: Claude is already very smart" | "Don't state the obvious" |
| Skills are folders | "Bundle additional content" | "Skills are folders, not just markdown" |
| Progressive disclosure via filesystem | Pattern 1/2/3, references one level deep | "Use the file system & progressive disclosure" |
| Description triggers discovery | "Critical for skill selection... 100+ skills" | "Description field is FOR THE MODEL... not a summary" |
| Set appropriate freedom (don't railroad) | Low/Medium/High freedom matched to fragility | "Avoid railroading Claude" — terse better than step-by-step |
| Provide scripts as utilities | "Provide utility scripts... more reliable than generated code" | "Store scripts & generate code" — helper libs Claude composes |
| Iterate from real usage | "Observe how Claude navigates Skills" | Most skills "got better because people kept adding" gotchas |

---

## 4. Differences and complementary insights

### Unique to Doc A (the rulebook)
- Hard limits: 500-line SKILL.md body, 64-char name, 1024-char description
- Naming convention: gerund form preferred
- Anti-patterns: Windows paths, too many options without default
- Script discipline: "solve don't punt", no voodoo constants
- Plan-validate-execute pattern for high-stakes batch ops
- **Build evals BEFORE docs** (evaluation-driven dev)
- Test across Haiku/Sonnet/Opus — instruction need varies by model
- Reference TOC for files >100 lines (counters partial-read with `head -100`)
- Concrete final checklist (core quality / code / testing)

### Unique to Doc B (the field report)
- **9-category taxonomy** — useful for org-level skill audits
- **Gotchas section as highest-signal content** — explicit pattern with growth example (Day 1 → Week 2 → Month 3)
- **Skill-scoped on-demand hooks** (e.g., `/careful`, `/freeze`)
- **Persistent data storage** in `${CLAUDE_PLUGIN_DATA}` (not skill dir, which can be wiped on upgrade)
- **Helper-library composition pattern** — give Claude `lib/*.py`, it generates ad-hoc scripts on top
- **Distribution mechanics** — checked-in vs plugin marketplace tradeoffs (context cost vs scale)
- **Skill measurement** via PreToolUse hook logging
- **Inter-skill composition** by reference (no native dep mgmt yet)
- **Setup pattern**: `config.json` + `AskUserQuestion` for user-specific context
- **Verification skills "worth a week"** — explicit ROI signal
- "**Don't state the obvious**" framing emphasizes pushing Claude OUT of defaults (not just skipping common knowledge)

### Tensions / nuances
- Doc A says "provide a default with escape hatch" for tool choice; Doc B says "avoid railroading" with terse step lists. Both agree on outcome (don't over-specify), but Doc A is more comfortable with prescriptive scripts for fragile ops (low-freedom mode). **Resolution**: prescriptive when fragile (Doc A's narrow bridge), terse when open (Doc B's railroading critique). Same axis, different vocabulary.
- Doc A treats memory/state minimally; Doc B treats it as a first-class capability with stable-folder guidance. No conflict — Doc B extends.

---

## 5. Consolidated best practices (MeowKit-ready)

### 5.1 Decide the skill type first

Pick from Doc B's 9 categories. If your skill straddles multiple, split it. Cross-check against existing `meow:*` skills before creating new (per `meow:skill-creator`).

### 5.2 Frontmatter

- `name`: ≤64 chars, lowercase + digits + hyphens; gerund form (`processing-X`) preferred for new skills (existing `meow:*` keep their conventions)
- `description`: ≤1024 chars, third person, includes WHAT + WHEN, key trigger terms; **write for the model, not the human**
- No reserved words: `anthropic`, `claude`
- No XML tags in either field

### 5.3 Body discipline

- SKILL.md body **under 500 lines**
- Split into reference files when approaching limit; **references one level deep only**
- Reference files **>100 lines need a TOC**
- Use forward slashes in all paths
- Consistent terminology (one term per concept, repeated)
- No time-sensitive prose; legacy → collapsed "old patterns" section

### 5.4 Content rules

- **Don't state the obvious.** Push Claude out of defaults (cite specific patterns to avoid, like Doc B's "Inter font / purple gradient" example).
- **Build a Gotchas section.** Grow it from observed failures. This is the highest-signal content per Doc B.
- **Set freedom level explicitly:**
  - Fragile/sequenced ops → low (specific script, no params, "do not modify")
  - Preferred pattern with variation → medium (template + params)
  - Open-ended judgment → high (terse intent: "resolve preserving intent")
- **Don't railroad** open-ended tasks with step-by-step commands.
- **Provide a default with escape hatch** when listing tool/library choices.
- **Examples pattern** for style-sensitive output (input/output pairs).

### 5.5 Filesystem layout

```
meow:my-skill/
├── SKILL.md              # entrypoint (≤500 lines)
├── references/           # one level deep, loaded on demand
│   └── api.md            # >100 lines → TOC at top
├── scripts/              # executed via bash, not loaded into context
│   └── helper.py
├── assets/               # templates, fixtures
└── lib/                  # helper libs Claude composes scripts on top of
```

### 5.6 Scripts

- **Solve, don't punt**: handle `FileNotFoundError`, `PermissionError`, etc. — don't fail and let Claude figure it out.
- **No voodoo constants**: every magic number has a comment explaining the choice.
- **Pre-made > generated** for utility scripts (reliability + token savings).
- **Make intent explicit**: "Run X" (execute) vs "See X for the algorithm" (read).
- **List dependencies** in SKILL.md; verify available in target environment.
- **Helper-library pattern (Doc B)**: ship `lib/*.py` with documented functions; let Claude compose new scripts. Especially powerful for data analysis.
- **Plan-validate-execute (Doc A)**: for batch/destructive ops, write structured plan → script-validate → execute → verify.

### 5.7 Workflows

- Multi-step tasks → copy-able checklist at top of the workflow section.
- Validator → fix → repeat loop for quality-critical output.
- Conditional workflows ("creating new? → ... editing existing? → ...") for branching.
- Push very long workflows into separate files; SKILL.md routes to them.

### 5.8 Setup, memory, hooks

- **User-specific setup**: store in `config.json` in skill dir; agent asks via `AskUserQuestion` if missing.
- **Persistent data**: store in `${CLAUDE_PLUGIN_DATA}` (Doc B) — skill dir may be wiped on upgrade. Append-only log, JSON, or SQLite as fits.
- **On-demand hooks**: register skill-scoped hooks that activate only during skill use (e.g., guardrails for destructive ops). Don't put always-on hooks here.

### 5.9 Composition

- Reference other skills by name in instructions; the model will invoke them if installed. No native dep mgmt yet.
- For MCP tools, always fully qualify: `ServerName:tool_name`.

### 5.10 Evaluation and iteration

- **Build evals BEFORE writing extensive docs** (Doc A). Identify gaps → 3+ scenarios → baseline → minimal instructions → iterate.
- **Author with Claude A, test with Claude B** (Doc A): observe Claude B's real navigation; bring observations back to Claude A.
- **Test across models** you plan to support (Haiku/Sonnet/Opus differ).
- **Measure usage** via PreToolUse hook logging (Doc B): catch undertriggering and over-popular skills.
- **Grow gotchas from observed failures** (Doc B): every new edge case → one more bullet.

### 5.11 Distribution

- **Checked into repo** (`.claude/skills/`) for small teams, few repos. Cost: every skill adds startup context.
- **Plugin marketplace** at scale: opt-in install, lower per-user context cost.
- **Curate before release**: bad/redundant skills are easy to create. Use sandbox folder + Slack signal before PR-ing into the marketplace.

### 5.12 Pre-publish checklist

Adapted from Doc A's checklist + Doc B's lessons:

**Quality**
- [ ] Description is third-person, specific, includes WHAT + WHEN, key trigger terms
- [ ] SKILL.md body <500 lines
- [ ] References one level deep; long refs have TOC
- [ ] Consistent terminology
- [ ] No time-sensitive content in main flow
- [ ] Gotchas section present (or planned for growth)
- [ ] Examples concrete (input/output pairs where output style matters)
- [ ] Workflows have copy-able checklists for multi-step

**Scripts**
- [ ] Errors handled, not punted
- [ ] No voodoo constants
- [ ] Forward slashes throughout
- [ ] Dependencies listed and verified available
- [ ] Execute-vs-read intent stated explicitly
- [ ] Helper libs documented for composition (where applicable)

**Testing**
- [ ] At least 3 evaluations created BEFORE writing extensive docs
- [ ] Tested across target models (Haiku/Sonnet/Opus)
- [ ] Tested with real tasks (Claude B), not synthetic prompts
- [ ] Observed navigation gaps and addressed them

**Distribution / governance**
- [ ] Decided: checked-in vs marketplace
- [ ] Usage measurement plan (PreToolUse hook) if go-to-market
- [ ] Composition: declared which other skills it references by name

---

## Unresolved questions

1. **Inter-skill dependencies**: Doc B says "no native dep mgmt yet." MeowKit's `meow:*` namespace heavily composes skills. Should we add a manifest field (`requires_skills:`) for static analysis, even without runtime enforcement?
2. **`${CLAUDE_PLUGIN_DATA}` portability**: Doc B introduces this as the stable-folder convention. MeowKit currently uses `.claude/memory/` and `tasks/` for persistence. Do we adopt `${CLAUDE_PLUGIN_DATA}` for new persistent skill state, or keep MeowKit-internal paths?
3. **500-line cap vs current MeowKit skills**: many existing `meow:*` SKILL.md files exceed 500 lines or use the step-file architecture (per `step-file-rules.md`). Should an audit be run to flag oversized monoliths for decomposition, or does step-file count as the decomposition?
4. **Eval-driven dev workflow**: Doc A's "build evals first" is not currently a MeowKit phase. Does it slot before Phase 1 (Plan) for skill authoring, or is it a meta-skill (e.g., `meow:skill-eval`)?
5. **Description vs `meow:` prefix**: gerund form is recommended, but MeowKit uses `meow:processing-X` style with prefix. Confirm current naming convention is intentional and not overdue for normalization.
