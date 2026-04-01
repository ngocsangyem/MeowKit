# Phase 5: Documentation + VitePress

## Context Links

- [Phase 1-4](.) — All implementation phases
- [VitePress site](../../website/) — MeowKit documentation site
- [v1.3.1 release page](../../website/guide/whats-new/v1.3.1.md) — Prior release pattern

## Overview

- **Priority:** P2
- **Status:** Pending
- **Effort:** ~2h
- **Depends on:** Phase 4 (documents what was built)
- **Description:** Update VitePress docs, CHANGELOG, planner agent, and SKILLS_INDEX to reflect the redesigned meow:plan-creator. Create v1.3.2 what's-new page.

## Requirements

### Functional
1. **VitePress what's-new page:** `website/guide/whats-new/v1.3.2.md`
2. **Update whats-new index:** Add v1.3.2 entry at top
3. **Update sidebar:** Add v1.3.2 to config.ts
4. **Update changelog:** Both `CHANGELOG.md` and `website/changelog.md`
5. **Update planner agent:** `agents/planner.md` — reference new step-file workflow
6. **Update SKILLS_INDEX:** meow:plan-creator description updated
7. **Update meowkit-rules.md if needed:** Plan file format now multi-file

### Non-Functional
- Follow existing release page format (see v1.3.1)
- No documentation dishonesty (only document implemented features)

## Implementation Steps

1. Create `website/guide/whats-new/v1.3.2.md` — The Plan Quality Release
2. Update `website/guide/whats-new.md` — add entry
3. Update `website/.vitepress/config.ts` — sidebar entry
4. Update `CHANGELOG.md` + `website/changelog.md`
5. Update `agents/planner.md` — reference step-file workflow, scope challenge, multi-file output
6. Update `agents/SKILLS_INDEX.md` — meow:plan-creator description
7. Update `RELEASING.md` — add v1.3.2 to release history
8. Verify VitePress builds: `cd website && npx vitepress build`

## Todo List

- [ ] Create v1.3.2 what's-new page
- [ ] Update whats-new.md index
- [ ] Update config.ts sidebar
- [ ] Update CHANGELOG.md (root)
- [ ] Update website/changelog.md
- [ ] Update planner.md agent
- [ ] Update SKILLS_INDEX.md
- [ ] Update RELEASING.md release history
- [ ] Verify VitePress build passes

## Success Criteria

1. VitePress build passes with new page
2. v1.3.2 appears in sidebar and whats-new index
3. Planner agent references step-file workflow
4. No documentation dishonesty

## Risk Assessment

| Risk | L | I | Mitigation |
|------|---|---|------------|
| Docs drift from implementation | L | M | Write docs AFTER phases 1-4 complete |
| VitePress build fails | L | L | Test build before committing |
