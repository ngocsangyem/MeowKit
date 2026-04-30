# Adversarial Review — Auto-Scaled (Step 3.8)

Adversarial review thoroughness scales automatically based on diff size. No configuration needed.

**Detect diff size:**

```bash
DIFF_INS=$(git diff origin/<base> --stat | tail -1 | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo "0")
DIFF_DEL=$(git diff origin/<base> --stat | tail -1 | grep -oE '[0-9]+ deletion' | grep -oE '[0-9]+' || echo "0")
DIFF_TOTAL=$((DIFF_INS + DIFF_DEL))
echo "DIFF_SIZE: $DIFF_TOTAL"
```

**User override:** If the user explicitly requested a specific tier (e.g., "run all passes", "paranoid review", "full adversarial", "thorough review"), honor that request regardless of diff size. Jump to the matching tier section.

**Auto-select tier based on diff size:**

- **Small (< 50 lines changed):** Skip adversarial review entirely. Print: "Small diff ($DIFF_TOTAL lines) — adversarial review skipped." Continue to the next step.
- **Medium (50–199 lines changed):** Run the Claude adversarial subagent. Jump to the "Medium tier" section.
- **Large (200+ lines changed):** Run Claude structured review (already done in Step 3.5) + Claude adversarial subagent. Jump to the "Large tier" section.

---

## Medium tier (50–199 lines)

Claude's structured review already ran. Now add a **Claude adversarial subagent** pass for genuine independence from the checklist-driven primary review.

**Claude adversarial subagent:**

Dispatch via the Agent tool. The subagent has fresh context — no checklist bias from the structured review. This genuine independence catches things the primary reviewer is blind to.

Subagent prompt:
"Read the diff for this branch with `git diff origin/<base>`. Think like an attacker and a chaos engineer. Your job is to find ways this code will fail in production. Look for: edge cases, race conditions, security holes, resource leaks, failure modes, silent data corruption, logic errors that produce wrong results silently, error handling that swallows failures, and trust boundary violations. Be adversarial. Be thorough. No compliments — just the problems. For each finding, classify as FIXABLE (you know how to fix it) or INVESTIGATE (needs human judgment)."

Present findings under an `ADVERSARIAL REVIEW (Claude subagent):` header. **FIXABLE findings** flow into the same Fix-First pipeline as the structured review. **INVESTIGATE findings** are presented as informational.

If the subagent fails or times out: "Claude adversarial subagent unavailable. Continuing without adversarial review."

**Persist the review result:**
```bash
.claude/scripts/bin/meowkit-review-log '{"skill":"adversarial-review","timestamp":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","status":"STATUS","source":"claude","tier":"medium","commit":"'"$(git rev-parse --short HEAD)"'"}'
```
Substitute STATUS: "clean" if no findings, "issues_found" if findings exist. If the subagent failed, do NOT persist.

---

## Large tier (200+ lines)

Claude's structured review already ran in Step 3.5. Now run the Claude adversarial subagent for maximum coverage.

**Claude adversarial subagent:** Dispatch a subagent with the adversarial prompt (same prompt as medium tier). Findings are classified FIXABLE / INVESTIGATE per the medium-tier flow.

If the Claude structured review flagged any `[P1]` findings, use AskUserQuestion:

```
Claude review found N critical issues in the diff.

A) Investigate and fix now (recommended)
B) Continue — review will still complete
```

If A: address the findings. After fixing, re-run tests (Step 3) since code has changed. Re-run structured review to verify.

**Persist the review result AFTER all passes complete:**
```bash
.claude/scripts/bin/meowkit-review-log '{"skill":"adversarial-review","timestamp":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","status":"STATUS","source":"claude","tier":"large","gate":"GATE","commit":"'"$(git rev-parse --short HEAD)"'"}'
```
Substitute: STATUS = "clean" if no findings across both passes, "issues_found" if any pass found issues. GATE = "pass" if no [P1] findings, "fail" if [P1] found. If both passes failed, do NOT persist.

---

## Synthesis (medium and large tiers)

After all passes complete, synthesize findings:

```
ADVERSARIAL REVIEW SYNTHESIS (auto: TIER, N lines):
════════════════════════════════════════════════════════════
  Structural findings (from pre-landing review): [summary]
  Adversarial findings (from subagent): [summary]
  Passes completed: Claude structured ✓  Claude adversarial ✓/✗
════════════════════════════════════════════════════════════
```

Findings from both sources should be prioritized consistently — structural review covers checklist-driven issues; adversarial subagent covers non-obvious failure modes.
