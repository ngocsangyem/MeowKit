# Phase 7: User Scope Input + Richer Frontmatter

## Context Links

- [Red-Team Report: Scope Gating](../reports/red-team-260401-2034-plan-creator-vs-ck-plan-comparison.md) — "meow assumes agent judgment; ck asks user"
- [CK Scope Challenge](../../../docs/claudekit-engineer/.claude/skills/ck-plan/references/scope-challenge.md) — EXPANSION/HOLD/REDUCTION
- [CK Output Standards](../../../docs/claudekit-engineer/.claude/skills/ck-plan/references/output-standards.md) — Richer YAML frontmatter

## Overview

- **Priority:** P2
- **Status:** Pending
- **Effort:** ~2h
- **Depends on:** Phase 1 (step-00 exists)
- **Description:** Add user scope input via AskUserQuestion at Step 0 (hard mode). Enrich plan.md frontmatter with description, tags, issue fields.

## Key Insights

- Current step-00 classifies complexity via agent judgment only. ck-plan asks the USER to choose EXPANSION/HOLD/REDUCTION — preventing "I thought minimal but agent went deep" misalignment.
- User input only needed in hard mode. Fast mode auto-detects (agent judgment is fine for simple tasks).
- Richer frontmatter (description, tags, issue) enables downstream tooling: filtering plans by tag, linking to GitHub issues, card previews.

## Requirements

### Functional
1. **User scope input (hard mode only):** After complexity classification in step-00, present AskUserQuestion:
   - EXPANSION: "Research deeply, explore alternatives, think big"
   - HOLD: "Scope is right, focus on bulletproof execution"
   - REDUCTION: "Strip to essentials, defer non-critical work"
2. **Scope mode affects planning:** EXPANSION → spawn extra researcher. HOLD → standard. REDUCTION → tighter constraints, smaller phase count.
3. **Richer frontmatter in plan.md template:**
   ```yaml
   description: "{one-line summary for card preview}"
   tags: ["{tag1}", "{tag2}"]
   issue: "{GitHub issue number or URL, if applicable}"
   ```
4. **Skip user input in fast mode** — agent auto-classifies, no AskUserQuestion.

### Non-Functional
- User scope input adds 1 AskUserQuestion call (~500 tokens)
- Frontmatter changes are backward-compatible (old plans without new fields still validate)

## Architecture

### Updated step-00 Flow

```
step-00 (current):
  0a. Read memory
  0b. Select workflow model
  0c. Scope assessment (agent-only)
  0d. Complexity classification
  0e. Mode selection

step-00 (updated, hard mode):
  0a. Read memory
  0b. Select workflow model
  0c. Scope assessment (agent-only)
  0d. Complexity classification
  0e. Mode selection
  0f. User Scope Input (hard mode only) — NEW
      → AskUserQuestion: EXPANSION / HOLD / REDUCTION
      → Store scope_mode for step-01 and step-03
```

### Scope Mode Effects

| Mode | Research | Phase Count | Constraints |
|------|----------|-------------|-------------|
| EXPANSION | 2 researchers + broader questions | Up to 7 phases | Explore alternatives |
| HOLD | 2 researchers (standard) | Standard | Execute within stated scope |
| REDUCTION | 1 researcher (focused) | Min phases (2-3) | Strip to MVP, defer rest |

## Related Code Files

### Files to Modify
- `meowkit/.claude/skills/meow:plan-creator/step-00-scope-challenge.md` — Add section 0f
- `meowkit/.claude/skills/meow:plan-creator/step-03-draft-plan.md` — Read scope_mode, adjust plan
- `meowkit/.claude/skills/meow:plan-creator/workflow.md` — Add scope_mode to variable table
- `meowkit/.claude/skills/meow:plan-creator/assets/plan-template.md` — Add description, tags, issue

## Implementation Steps

1. Add section 0f to step-00: AskUserQuestion with 3 scope modes (hard mode only)
2. Add `scope_mode` to workflow.md variable table
3. Update step-03: read scope_mode, adjust researcher count and phase limits
4. Update plan-template.md: add description, tags, issue fields to frontmatter
5. Update validate-plan.py: accept (but don't require) new frontmatter fields
6. Test: fast mode skips user input, hard mode asks

## Todo List

- [ ] Add section 0f (User Scope Input) to step-00
- [ ] Add scope_mode variable to workflow.md
- [ ] Update step-03 to respect scope_mode (EXPANSION/HOLD/REDUCTION)
- [ ] Add description, tags, issue to plan-template.md frontmatter
- [ ] Update validate-plan.py for new optional fields
- [ ] Test: fast mode skips, hard mode asks user

## Success Criteria

1. Hard mode presents EXPANSION/HOLD/REDUCTION choice before research
2. REDUCTION mode limits phases to 2-3 and uses 1 researcher
3. EXPANSION mode allows up to 7 phases and broader research
4. plan.md frontmatter includes description, tags, issue (optional)
5. Fast mode skips user input entirely

## Risk Assessment

| Risk | L | I | Mitigation |
|------|---|---|------------|
| User confused by scope modes | L | L | Clear descriptions in AskUserQuestion options |
| REDUCTION strips too aggressively | L | M | User chose it explicitly; can re-run with HOLD |
| New frontmatter breaks old plans | L | L | Fields are optional; validate-plan.py accepts missing |

## Security Considerations

N/A — no security-sensitive changes.

## Next Steps

- Phase 8 depends on this: scope_mode stored in plan state for sync-back
