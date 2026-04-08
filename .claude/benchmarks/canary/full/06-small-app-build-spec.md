---
benchmark_task: 06-small-app-build
tier: full
target_seconds: 5400
target_cost_usd: 25
rubric_preset: fullstack-product
---

# Task: Build a Mini "Notes" App End-to-End

**`--full` tier ONLY.** This task triggers `meow:harness` for a complete green-field build and can run for 60–90 minutes. Refuses to run without the explicit `--full` flag.

## Product Spec (input to `meow:plan-creator --product-level`)

Build a single-user web app called **Quill** for taking quick text notes.

### Features (8 minimum)

1. **Create note** — single input + Enter to save
2. **List notes** — newest first, with title (first line) + 2-line preview
3. **Edit note** — click a note to expand into a full editor
4. **Delete note** — confirm dialog, soft-delete (recoverable)
5. **Search** — instant filter by title or body
6. **Tags** — comma-separated; click a tag to filter
7. **Local persistence** — survives page refresh (localStorage acceptable for this canary)
8. **Empty state** — first-time user sees "No notes yet — write your first" with a sample suggestion

### Tech Constraints

- React or Vue (harness picks)
- TypeScript
- Single-page app — no backend required for v1
- One single-file CSS or one component library; no design system overengineering

## Acceptance Criteria

- [ ] All 8 features implemented and reachable from the UI
- [ ] App boots locally on `npm run dev`
- [ ] No console errors on happy path
- [ ] At least 5 unit tests covering core operations (create, edit, delete, search, tag-filter)
- [ ] Visual: not generic AI slop — has a name (Quill), specific copy, custom empty state

## Rubric Preset

`fullstack-product` (loads all 7 rubrics with ux-usability weighted 3x higher).

## Notes

This is the heavy canary. It exercises the full pipeline: planner → contract → generator → evaluator → ship. If this fails, the whole harness has a regression.

**Cost guard:** the script halts and emits a warning if projected cost exceeds $25 partway through. Hard cap at $30 (set by `meow:benchmark` SKILL.md).

**Auto-suggested when:** running the dead-weight audit (real-build context required), or when verifying a major harness change end-to-end.
