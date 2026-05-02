---
title: "mk:qa"
description: "Systematic QA testing with bug fixing — three tiers (Quick/Standard/Exhaustive), health scores, and fix evidence."
---

# mk:qa

QA engineer AND bug-fix engineer. Tests web applications like a real user — click everything, fill every form, check every state. Finds bugs, fixes them in source with atomic commits, re-verifies. Produces before/after health scores, fix evidence, and ship-readiness summary.

## When to use

"qa", "QA", "test this site", "find bugs", "test and fix", "fix what's broken", "does this work?"

## Three tiers

| Tier | Scope | When |
|---|---|---|
| Quick | Critical + high only | Quick sanity check |
| Standard | + medium severity | Normal QA pass |
| Exhaustive | + cosmetic | Before major release |

## Process

1. Test — run QA checks at selected tier
2. Fix — atomic commits per bug fix
3. Verify — re-test after fixes
4. Report — before/after health score + evidence + ship-readiness
