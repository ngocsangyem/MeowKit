# Step 9: Post-Plan Handoff

Deterministic handoff after task hydration. Presents mode-pruned options via `stop and ask the user in chat`, writes the chosen next-step to plan.md frontmatter, prints the suggested command, and STOPs without auto-invoking it.

## Inputs

- `planning_mode` (from step-00)
- `tdd_mode` (from step-00)
- `matched_flags` (from `mk:agent-detector` Phase 0; may be unset when plan-creator invoked directly)
- `plan_dir` (from step-03)

## Instructions

### 9a. Defensive Fallback Advisory

If `matched_flags` is unset OR empty AND `planning_mode` is `fast` or `spike`, print this advisory BEFORE the `stop and ask the user in chat`:

```
`matched_flags` is unset — plan-creator was invoked directly rather than
through `mk:agent-detector` routing. Using default mode recommendation.
For risk-tiered routing, invoke via `the cook skill` or `the fix skill`.
```

### 9b. Live Risk Re-Scan

Run a single grep pass over `plan.md` and every `phase-XX-*.md` for trigger keywords from `.agents/skills/rule-risk-checklist.md`: `AUTH`, `AUTHZ`, `DATA_MODEL`, `AUDIT_SEC`, `EXT_SYSTEM`. Use literal-string match (no regex).

If any keyword appears that was NOT in the original `matched_flags`, print this advisory and treat the re-scan match as the effective risk set for option ordering:

```
Plan content suggests {flag}-class risk surface not flagged at Phase 0
scope check. Red-team review is recommended before implementation.
```

Conservative false-positives are accepted — the user has final say via the option choice.

### 9c. Build Option Set

Compute the effective risk set: `risk_hit = (matched_flags ∪ re_scan_flags) ∩ {AUTH, AUTHZ, DATA_MODEL, AUDIT_SEC, EXT_SYSTEM}`.

Option set is mode-pruned. First option is `(Recommended)`. stop and ask the user in chat caps options at 4.

| Mode | risk_hit non-empty? | Options (first = Recommended) |
|---|---|---|
| fast | yes | Red-team, Validate, Cook, End |
| fast | no | Cook, Validate, Red-team, End |
| hard / deep / parallel / two | (n/a — both prior gates ran) | Cook, End |
| product-level | (n/a) | Hand off to mk:autobuild, End |
| spike | (n/a) | Cook, End |

### 9d. Present stop and ask the user in chat

Build the question payload using the option set above. Each option has `label` and `description` (≤120 chars). Labels are display-only — no shell-executable text.

```json
{
  "questions": [{
    "question": "Plan is approved and tasks hydrated. What next?",
    "header": "Next Step",
    "options": [
      { "label": "Cook (Recommended)", "description": "Run the cook skill to implement the plan" },
      { "label": "Validate", "description": "Run the plan skill validate for a critical-questions interview" },
      { "label": "Red-team", "description": "Run the plan skill red-team for adversarial review" },
      { "label": "End", "description": "Stop here — review plan before deciding" }
    ],
    "multiSelect": false
  }]
}
```

(Substitute the pruned option subset per the table above.)

### 9e. Write Frontmatter

After the user selects, edit `plan.md` to add (or update) under the existing frontmatter block:

```yaml
handoff:
  next: <choice>
  decided_at: <ISO-8601 timestamp>
```

Where `<choice>` is one of `cook | validate | red-team | autobuild | end`. Use the Edit tool with the existing `---` boundary as the exact-match context — do NOT overwrite the body.

### 9f. Print Suggested Command

Print exactly one line matching the selection:

| Selection | Output line |
|---|---|
| Cook | `Run: the cook skill {absolute-path-to-plan.md}` |
| Cook with TDD | `Run: the cook skill {absolute-path-to-plan.md} --tdd` |
| Cook (parallel mode) | `Run: the cook skill --parallel {absolute-path-to-plan.md}` |
| Cook (parallel + TDD) | `Run: the cook skill --parallel {absolute-path-to-plan.md} --tdd` |
| Cook (fast mode) | `Run: the cook skill --auto {absolute-path-to-plan.md}` |
| Cook (fast + TDD) | `Run: the cook skill --auto {absolute-path-to-plan.md} --tdd` |
| Validate | `Run: the plan skill validate {absolute-path-to-plan.md}` |
| Red-team | `Run: the plan skill red-team {absolute-path-to-plan.md}` |
| Hand off to mk:autobuild | `Run: the autobuild skill {absolute-path-to-plan.md}` |
| End | (no command line — print "Plan complete. No next command queued.") |

If `tdd_mode = true`, always use the matching TDD cook line above. Do not rely on `.codex/session-state/tdd-mode` surviving a fresh session.

After the command line, print the Context Reminder block from `references/gate-1-approval.md` with the absolute path substituted.

### 9f-bis. Terminal Wiki Handoff (advisory, fail-open)

The plan was just approved, so `plan.md` is a durable, user-chosen artifact. Per the
shared contract in `.agents/skills/wiki/references/terminal-handoff-advisory.md`, hand it
to the wiki AFTER the command line is printed and BEFORE the STOP. This adds no gate and
no prompt; a failure is advisory only.

Resolve the slug (env `MEOWKIT_WIKI_SLUG` → the sole `tasks/wikis/<slug>/wiki.json` → else skip):

```bash
npx mewkit wiki handoff propose \
  --skill mk:plan-creator \
  --from {plan_dir}/plan.md \
  --slug <resolved-wiki-slug> \
  --explicit-intent
```

If no unique slug resolves, print the command above with a literal `--slug <slug>` for the
user and continue. Do NOT run `wiki approve`. Do NOT add `wiki reindex` to this step.

### 9g. Stop

**STOP. Do NOT auto-invoke the next command.** The user must type the suggested command themselves so a fresh session can pick up cleanly without planning-context carryover.

## Output

- `plan.md` frontmatter contains `handoff: { next, decided_at }`.
- Suggested command printed.
- Context Reminder block printed.
- Terminal wiki handoff attempted (advisory, fail-open) per 9f-bis.
- Session STOPs.

## Next

STOP. User decides.
