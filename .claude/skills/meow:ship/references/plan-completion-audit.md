# Plan Completion Audit and Verification (Steps 3.45 and 3.47)


## Contents

- [Step 3.45: Plan Completion Audit](#step-345-plan-completion-audit)
  - [Plan File Discovery](#plan-file-discovery)
  - [Actionable Item Extraction](#actionable-item-extraction)
  - [Cross-Reference Against Diff](#cross-reference-against-diff)
  - [Output Format](#output-format)
- [Implementation Items](#implementation-items)
- [Test Items](#test-items)
- [Migration Items](#migration-items)
  - [Gate Logic](#gate-logic)
- [Step 3.47: Plan Verification (manual follow-up)](#step-347-plan-verification-manual-follow-up)

## Step 3.45: Plan Completion Audit

### Plan File Discovery

1. **Conversation context (primary):** Check if there is an active plan file in this conversation — Claude Code system messages include plan file paths when in plan mode. Look for references like `.claude/plans/*.md` or `tasks/plans/*.md` in system messages. If found, use it directly — this is the most reliable signal.

2. **Content-based search (fallback):** If no plan file is referenced in conversation context, search by content:

```bash
# Plans live at .claude/plans/ or tasks/plans/ in this kit layout; ~/.claude/plans/ is a legacy fallback.
BRANCH=$(git branch --show-current 2>/dev/null | tr '/' '-')
REPO=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)")
PLAN_DIRS=".claude/plans tasks/plans"
# Try branch name match first (most specific)
PLAN=$(ls -t $PLAN_DIRS/*.md $PLAN_DIRS/**/*.md 2>/dev/null | xargs grep -l "$BRANCH" 2>/dev/null | head -1)
[ -z "$PLAN" ] && PLAN=$(ls -t ~/.claude/plans/*.md 2>/dev/null | xargs grep -l "$BRANCH" 2>/dev/null | head -1)
# Fall back to repo name match
[ -z "$PLAN" ] && PLAN=$(ls -t $PLAN_DIRS/*.md $PLAN_DIRS/**/*.md 2>/dev/null | xargs grep -l "$REPO" 2>/dev/null | head -1)
[ -z "$PLAN" ] && PLAN=$(ls -t ~/.claude/plans/*.md 2>/dev/null | xargs grep -l "$REPO" 2>/dev/null | head -1)
# Last resort: most recent plan modified in the last 24 hours
[ -z "$PLAN" ] && PLAN=$(find $PLAN_DIRS -name '*.md' -mmin -1440 2>/dev/null | xargs ls -t 2>/dev/null | head -1)
[ -z "$PLAN" ] && PLAN=$(find ~/.claude/plans -name '*.md' -mmin -1440 -maxdepth 1 2>/dev/null | xargs ls -t 2>/dev/null | head -1)
[ -n "$PLAN" ] && echo "PLAN_FILE: $PLAN" || echo "NO_PLAN_FILE"
```

3. **Validation:** If a plan file was found via content-based search (not conversation context), read the first 20 lines and verify it is relevant to the current branch's work. If it appears to be from a different project or feature, treat as "no plan file found."

**Error handling:**
- No plan file found → skip with "No plan file detected — skipping."
- Plan file found but unreadable (permissions, encoding) → skip with "Plan file found but unreadable — skipping."

### Actionable Item Extraction

Read the plan file. Extract every actionable item — anything that describes work to be done. Look for:

- **Checkbox items:** `- [ ] ...` or `- [x] ...`
- **Numbered steps** under implementation headings: "1. Create ...", "2. Add ...", "3. Modify ..."
- **Imperative statements:** "Add X to Y", "Create a Z service", "Modify the W controller"
- **File-level specifications:** "New file: path/to/file.ts", "Modify path/to/existing.rb"
- **Test requirements:** "Test that X", "Add test for Y", "Verify Z"
- **Data model changes:** "Add column X to table Y", "Create migration for Z"

**Ignore:**
- Context/Background sections (`## Context`, `## Background`, `## Problem`)
- Questions and open items (marked with ?, "TBD", "TODO: decide")
- Review report sections (`## MEOWKIT REVIEW REPORT`)
- Explicitly deferred items ("Future:", "Out of scope:", "NOT in scope:", "P2:", "P3:", "P4:")
- CEO Review Decisions sections (these record choices, not work items)

**Cap:** Extract at most 50 items. If the plan has more, note: "Showing top 50 of N plan items — full list in plan file."

**No items found:** If the plan contains no extractable actionable items, skip with: "Plan file contains no actionable items — skipping completion audit."

For each item, note:
- The item text (verbatim or concise summary)
- Its category: CODE | TEST | MIGRATION | CONFIG | DOCS

### Cross-Reference Against Diff

Run `git diff origin/<base>...HEAD` and `git log origin/<base>..HEAD --oneline` to understand what was implemented.

For each extracted plan item, check the diff and classify:

- **DONE** — Clear evidence in the diff that this item was implemented. Cite the specific file(s) changed.
- **PARTIAL** — Some work toward this item exists in the diff but it's incomplete (e.g., model created but controller missing, function exists but edge cases not handled).
- **NOT DONE** — No evidence in the diff that this item was addressed.
- **CHANGED** — The item was implemented using a different approach than the plan described, but the same goal is achieved. Note the difference.

**Be conservative with DONE** — require clear evidence in the diff. A file being touched is not enough; the specific functionality described must be present.
**Be generous with CHANGED** — if the goal is met by different means, that counts as addressed.

### Output Format

```
PLAN COMPLETION AUDIT
═══════════════════════════════
Plan: {plan file path}

## Implementation Items
  [DONE]      Create UserService — src/services/user_service.rb (+142 lines)
  [PARTIAL]   Add validation — model validates but missing controller checks
  [NOT DONE]  Add caching layer — no cache-related changes in diff
  [CHANGED]   "Redis queue" → implemented with Sidekiq instead

## Test Items
  [DONE]      Unit tests for UserService — test/services/user_service_test.rb
  [NOT DONE]  E2E test for signup flow

## Migration Items
  [DONE]      Create users table — db/migrate/20240315_create_users.rb

─────────────────────────────────
COMPLETION: 4/7 DONE, 1 PARTIAL, 1 NOT DONE, 1 CHANGED
─────────────────────────────────
```

### Gate Logic

After producing the completion checklist:

- **All DONE or CHANGED:** Pass. "Plan completion: PASS — all items addressed." Continue.
- **Only PARTIAL items (no NOT DONE):** Continue with a note in the PR body. Not blocking.
- **Any NOT DONE items:** Use AskUserQuestion:
  - Show the completion checklist above
  - "{N} items from the plan are NOT DONE. These were part of the original plan but are missing from the implementation."
  - RECOMMENDATION: depends on item count and severity. If 1-2 minor items (docs, config), recommend B. If core functionality is missing, recommend A.
  - Options:
    A) Stop — implement the missing items before shipping
    B) Ship anyway — defer these to a follow-up (will create P1 TODOs in Step 5.5)
    C) These items were intentionally dropped — remove from scope
  - If A: STOP. List the missing items for the user to implement.
  - If B: Continue. For each NOT DONE item, create a P1 TODO in Step 5.5 with "Deferred from plan: {plan file path}".
  - If C: Continue. Note in PR body: "Plan items intentionally dropped: {list}."

**No plan file found:** Skip entirely. "No plan file detected — skipping plan completion audit."

**Include in PR body (Step 8):** Add a `## Plan Completion` section with the checklist summary.

---

## Step 3.47: Plan Verification (manual follow-up)

Plan-level verification is not run automatically during `/meow:ship`. If the plan has a verification section, remind the user:

**If no verification section found in the plan file from Step 3.45:** Skip silently.

**If verification section exists:** Output a single-line reminder after ship completes:
> "Plan contains verification steps. Run `/meow:qa` after deploy to validate them against a running dev server."

Rationale: automatic plan verification requires a reliable dev-server detection + browser orchestration path. Ship is not the right place for that — `meow:qa` owns it. Ship's job is to get the PR out; QA runs against the deployed build.