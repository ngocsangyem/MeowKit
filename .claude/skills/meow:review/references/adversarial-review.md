# Adversarial Review (Step 5.7 — auto-scaled)

Adversarial review scales automatically based on diff size. Claude-only pipeline — no external model required.

## Detect diff size

```bash
DIFF_INS=$(git diff origin/<base> --stat | tail -1 | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo "0")
DIFF_DEL=$(git diff origin/<base> --stat | tail -1 | grep -oE '[0-9]+ deletion' | grep -oE '[0-9]+' || echo "0")
DIFF_TOTAL=$((DIFF_INS + DIFF_DEL))
echo "DIFF_SIZE: $DIFF_TOTAL"
```

**User override:** If the user explicitly requested a specific tier (e.g., "run all passes", "paranoid review", "full adversarial", "thorough review"), honor that request regardless of diff size. Jump to the matching tier section.

**Auto-select tier based on diff size:**
- **Small (< 50 lines changed):** Skip adversarial review entirely. Print: "Small diff ($DIFF_TOTAL lines) — adversarial review skipped." Continue to the next step.
- **Medium (50-199 lines changed):** Run one Claude adversarial subagent. Jump to the "Medium tier" section.
- **Large (200+ lines changed):** Run two Claude adversarial subagents (attack-surface + failure-mode). Jump to the "Large tier" section.

---

## Medium tier (50-199 lines)

Claude's structured review already ran. Add a Claude adversarial subagent with fresh context.

Dispatch via the Agent tool. Subagent prompt:
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

Claude's structured review already ran. Run two independent adversarial passes in separate subagent contexts for maximum coverage.

**1. Attack-surface pass:** Dispatch a subagent with the adversarial prompt from the medium tier. Focus: attacker mindset, injection vectors, auth bypass, resource leaks.

**2. Failure-mode pass:** Dispatch a second subagent with this prompt:
"Read the diff for this branch with `git diff origin/<base>`. Think like a chaos engineer investigating a production incident. Your job is to find failure modes that cause silent data corruption, cascading errors, or resource exhaustion. Trace every branch and boundary. Look for race conditions, partial failures, retry storms, missing idempotency, and error paths that leave the system in a bad state. Classify each finding as FIXABLE or INVESTIGATE."

Each subagent has fresh context — genuine independence catches what the primary reviewer is blind to.

Present findings under:
- `ADVERSARIAL REVIEW (attack surface):`
- `ADVERSARIAL REVIEW (failure modes):`

Both flows: FIXABLE findings → Fix-First pipeline; INVESTIGATE findings → informational.

**Persist the review result AFTER all passes complete** (not after each sub-step):
```bash
.claude/scripts/bin/meowkit-review-log '{"skill":"adversarial-review","timestamp":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","status":"STATUS","source":"claude","tier":"large","commit":"'"$(git rev-parse --short HEAD)"'"}'
```
Substitute STATUS: "clean" if no findings across BOTH passes, "issues_found" if any pass found issues. If both passes failed, do NOT persist.

---

## Cross-pass synthesis (medium and large tiers)

After all passes complete, synthesize findings:

```
ADVERSARIAL REVIEW SYNTHESIS (auto: TIER, N lines):
========================================================
  High confidence (found by multiple passes): [findings agreed on by >1 pass]
  Unique to Claude structured review: [from earlier step]
  Unique to attack-surface adversarial: [from first subagent]
  Unique to failure-mode adversarial: [from second subagent — large tier only]
  Passes ran: structured Y/N  attack-surface Y/N  failure-mode Y/N
========================================================
```

High-confidence findings (agreed on by multiple passes) should be prioritized for fixes.
