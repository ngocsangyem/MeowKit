# Verdict and Output

## Verdict

Any BLOCKER or any lens FAIL means NEEDS REVISION. Otherwise APPROVED, with notes when HIGH-LEVERAGE or POLISH items exist.

## What to write

Append to the end of `plan.md`, below any existing review report, and never overwrite existing content. Every mode writes this block.

```markdown
## CEO Review ({date}, {MODE} scope)

**Verdict:** APPROVED | APPROVED with notes | NEEDS REVISION
**Lenses:** intent {PASS|WARN|FAIL}, execution {PASS|WARN|FAIL}
**Pre-screen:** {clean | N gaps noted}
**Coverage:** {N} of {M} requirements mapped
**Blockers:** {count and list}
**High-leverage:** {count and short list}
**Polish:** {count}
**Not in scope:** {work considered and deferred, one line of reason each}
**Already exists:** {code or flows that partly solve sub-problems, and whether the plan reuses them}
**Unresolved decisions:** {any question the user left unanswered; never default silently}
```

Under EXPANSION and SELECTIVE EXPANSION add `**Scope decisions:**` with accepted, deferred and skipped expansion proposals. Where the plan has failure paths, add a short table of codepath, failure, rescued, tested and what the user sees.

Done when the block is in the plan (re-read its tail) and the verdict is stated to the user.
