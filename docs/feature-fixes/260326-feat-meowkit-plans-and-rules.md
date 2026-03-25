# MeowKit Plans and Rules System

**Date**: 2026-03-26
**Type**: Feature
**Scope**: Plan templates + rules system

## Plan Templates Created

| File | Purpose |
|------|---------|
| `tasks/templates/plan-template.md` | Master plan template — all sections, frontmatter, status log |
| `tasks/templates/plan-quick.md` | Shortened template for tasks < 5 files or < 2 hours |
| `tasks/templates/plan-phase.md` | Single-phase template for multi-phase plans |
| `.claude/skills/plan-creator/SKILL.md` | Skill that auto-selects template by task scope |

**Why**: claudekit-engineer had 3 plan templates (feature, bugfix, refactor) with a usage guide. MeowKit synthesized these into a scope-based system (quick vs full vs multi-phase) that is template-type-agnostic — any task type uses the same templates, sized by scope. Design informed by:
- claude-prompting-best-practices.md: long content at top, query at bottom (30% improvement)
- codex-prompt-guide.md: plan closure rule, promise discipline
- prompt-crafting-for-different-models.md: acceptance criteria, explicit constraints

**CLAUDE.md updated**: Added "## Planning" section with template routing, rules, and file locations.

## Rules — claudekit-engineer Evaluation

### Scoring criteria
- Specificity (x2): 5 = prevents concrete failure, 1 = generic advice
- Enforceability (x2): 5 = mechanically checkable, 1 = subjective
- Universality (x1): 5 = any project, 1 = CK-specific

### Decisions

| Rule | Score /25 | Decision | Notes |
|------|-----------|----------|-------|
| File naming: kebab-case, descriptive | 24 | ADOPT | Directly applicable |
| File size < 200 lines | 23 | ADOPT | Universal |
| No enhanced copies, update existing | 23 | ADOPT | Prevents file duplication |
| No syntax errors, must compile | 25 | ADOPT | Highest enforceability |
| Pre-commit: lint, test, no secrets | 23 | ADOPT | Universal git safety |
| Conventional commits | 21 | ADOPT | Standard format |
| Don't simulate/mock implementations | 23 | ADOPT | Prevents false passing |
| Fix all tests before finishing | 25 | ADOPT | Critical for CI integrity |
| Plan naming: YYMMDD-feature-name | 24 | ADOPT | Already in templates |
| Compile check after code modification | 25 | ADOPT | Immediate error detection |
| Delegation context (work path, plan ref) | 19 | ADOPT | Essential for subagents |
| File ownership: no overlapping edits | 19 | ADOPT | Prevents merge conflicts |
| Git safety: never force-push | 25 | ADOPT | Universal safety |
| Docs impact declaration | 20 | ADOPT | Prevents knowledge gaps |
| YAGNI/KISS/DRY principles | 13 | ADAPT | Too generic, added WHY |
| Docs update triggers | 16 | ADAPT | Simplified for MeowKit |
| Sequential/parallel chaining | 16 | ADAPT | Generalized from CK agents |
| Task claiming: lowest-ID first | 14 | ADAPT | Included in orchestration |
| "Follow codebase structure in ./docs" | 11 | SKIP | Too vague to enforce |
| "Use docs-seeker/ai-multimodal skills" | 9 | SKIP | CK-specific tools |
| "Delegate to named agents" | 11 | SKIP | CK-specific agents |
| SendMessage/TaskUpdate protocol | 11 | SKIP | CK-specific infrastructure |
| Shutdown protocol | 11 | SKIP | CK-specific |
| Idle state handling | 7 | SKIP | CK-specific |

## 3 New Rules Created

| Rule file | Principle Source | Key Finding Applied |
|-----------|----------------|-------------------|
| `context-ordering-rules.md` | claude-prompting-best-practices.md | "Queries at the end can improve response quality by up to 30%" — long content at top, task at bottom |
| `model-selection-rules.md` | prompt-crafting-for-different-models.md | Model Selection Strategy table: Opus for architecture, Sonnet for features, Haiku for quick edits |
| `output-format-rules.md` | codex-prompt-guide.md + all 3 files | "Lead with a quick explanation of the change, then give more details on context covering where and why" |

## 5 Rule-Writing Principles Applied

1. Tell agent what TO DO, not just what NOT to do (claude-prompting-best-practices.md)
2. Context before constraint — explain WHY before the rule (universal)
3. Use clear headers for rule boundaries (claude-prompting-best-practices.md)
4. Numbered steps for procedures, imperatives for constraints (codex-prompt-guide.md)
5. Binary, measurable acceptance conditions (prompt-crafting-for-different-models.md)

## All Files Created

```
meowkit/
├── tasks/templates/
│   ├── plan-template.md              ← Master plan template
│   ├── plan-quick.md                 ← Quick plan (< 5 files)
│   └── plan-phase.md                 ← Multi-phase plan phase template
├── .claude/skills/plan-creator/
│   └── SKILL.md                      ← Plan routing skill
├── .claude/rules/
│   ├── development-rules.md          ← Adopted + adapted from CK
│   ├── orchestration-rules.md        ← Adopted + adapted from CK
│   ├── context-ordering-rules.md     ← NEW: context ordering
│   ├── model-selection-rules.md      ← NEW: model tier routing
│   ├── output-format-rules.md        ← NEW: response structure
│   └── RULES_INDEX.md                ← Index of all 10 rule files
├── CLAUDE.md                         ← Updated: added Planning section
└── docs/feature-fixes/
    └── 260326-feat-meowkit-plans-and-rules.md  ← This file
```
