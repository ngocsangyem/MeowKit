# CLAUDE.md Review — Post Index-File Ship Fix

Run: 2026-05-09 02:01 | File: `meowkit/CLAUDE.md` (121 lines) | Trigger: after `walkDir` fix that lets 5 `*_INDEX.md` files ship via `mewkit init`.

## TL;DR

CLAUDE.md is structurally sound. **One actionable change** (medium): surface `SKILLS_INDEX.md` so Claude can discover skills in user projects. **One optional change** (low): re-add the maintainer HTML comment for human contributors. Everything else is clean.

## Mechanical checks

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Line count | ≤150 (MeowKit), ≤200 (Anthropic) | 121 | ✅ |
| Pointer paths resolve | 16/16 | 16/16 | ✅ |
| Orphaned section headers | 0 | 0 | ✅ |
| Skill Rule of Two relocated to injection-rules.md Rule 11 | match | match | ✅ |
| Plan-creator path (`tasks/plans/YYMMDD-name/`) documented | yes | yes (line 57) | ✅ |
| `validate-docs.py` line-count enforcement | exit 0 at 121 | exit 0 | ✅ |

## Index-file inventory (after walkDir fix)

| File | Lines | Referenced in CLAUDE.md? | Recommendation |
|------|-------|--------------------------|----------------|
| `.claude/rules/RULES_INDEX.md` | 106 | ✅ ×2 (lines 72, 114) | Keep as-is — load-bearing entry point |
| `.claude/agents/SKILLS_INDEX.md` | 157 | ❌ | **Add 1-line pointer** (medium-priority) |
| `.claude/agents/AGENTS_INDEX.md` | 50 | ❌ (but `agent-routing.md` covers core) | Cross-link from `agent-routing.md`, NOT CLAUDE.md |
| `.claude/hooks/HOOKS_INDEX.md` | 97 | ❌ | Skip — maintainer concern, not session-time |
| `.claude/rubrics/RUBRICS_INDEX.md` | 88 | ❌ | Skip — niche; loaded via `mk:rubric`/`mk:evaluate` |

## Findings

### F1 — MEDIUM: `SKILLS_INDEX.md` not surfaced

**Issue:** CLAUDE.md line 21 says "Activate only skills needed for the current task domain" but gives Claude no entry point to discover the 76 shipped skills. After the walkDir fix, `SKILLS_INDEX.md` (157 lines, organized "By Phase") will ship to user projects — perfect for skill discovery, but Claude has no breadcrumb to it.

**Fix:** Add one line to the existing `## Pointers` block, between the "Advisory skill frontmatter fields" line and `## Docs Retrieval & Rules Index`:

```markdown
- **Skill catalog:** `.claude/agents/SKILLS_INDEX.md` (76 skills indexed by phase + intent)
```

Cost: +1 line → 122 lines. Still under 150.

### F2 — LOW: `AGENTS_INDEX.md` ships alongside `agent-routing.md`

**Issue:** Two routing surfaces will exist after the walkDir fix:
- `.claude/rules/agent-routing.md` (NEW; 31 lines; 17-row routing table) — pointed to from CLAUDE.md
- `.claude/agents/AGENTS_INDEX.md` (50 lines; richer columns: Type, CE version, Last improved) — ships independently

Risk: drift over time. Maintainers update one, forget the other.

**Fix:** Don't pile both into CLAUDE.md. Add a one-line cross-link inside `.claude/rules/agent-routing.md` (e.g., "For provenance metadata see `.claude/agents/AGENTS_INDEX.md`"). Keep CLAUDE.md unchanged.

### F3 — LOW: maintainer HTML comment removed

**Issue:** The Phase 4 rewrite included an HTML comment near the top warning future contributors not to re-add the relocated tables. The current file (per latest user edit) drops it. Anthropic strips block-level HTML before context — Claude never sees it — so no runtime impact. But human contributors editing the file lose the safeguard.

**Fix (optional):** Re-add a 4-line comment if the project values the human-facing safeguard:

```html
<!-- maintainer: loaded into every session. Keep ≤150 lines.
     Per Anthropic, longer files reduce adherence. HTML comments are
     stripped pre-injection — Claude does not see this. Do NOT re-add
     relocated tables; see Pointers section + .claude/rules/. -->
```

User explicitly removed it once already. Defer to user preference; if not re-added, recommend adding the same warning to `.claude/rules/RULES_INDEX.md` instead (where rule maintenance is already documented).

### F4 — OK: index files no longer dangling

Pre-fix, references to `RULES_INDEX.md` worked in the source repo but **broke** in user projects after `mewkit init` (file wasn't copied). After the walkDir fix, all 5 INDEX files ship. CLAUDE.md's existing 2 references to `RULES_INDEX.md` now work end-to-end. No action needed.

## Recommendations summary

| # | Action | Lines added | Severity |
|---|--------|------------:|----------|
| 1 | Add `SKILLS_INDEX.md` pointer in `## Pointers` block | +1 | Medium |
| 2 | Cross-link `AGENTS_INDEX.md` from inside `agent-routing.md` (not CLAUDE.md) | 0 (CLAUDE.md unchanged) | Low |
| 3 | Re-add maintainer HTML comment near top (optional) | +4 | Low |

After F1+F3: CLAUDE.md = ~126 lines (≤150 ✅).
After F1 only: CLAUDE.md = 122 lines.

## Open questions

None — the audit covered every pointer, the post-walkDir-fix index inventory, and the file-size budget.
