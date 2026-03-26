---
title: Shipping Code
description: The complete ship pipeline from tests to PR.
persona: B
---

# Shipping Code

> Full ship pipeline: test → review → version bump → commit → PR → CI verify.

**Best for:** Persona B  
**Time estimate:** 5-10 minutes  
**Skills used:** meow:ship

## Step 1: Ship

```
/meow:ship                      # auto-detect mode (official or beta)
/meow:ship official              # ship to main branch
/meow:ship beta                  # ship to dev/beta branch
/meow:ship --dry-run             # preview what would happen
```

## What happens

1. Pre-flight: verify feature branch, detect base branch
2. Merge base branch, bootstrap tests if needed
3. Run full test suite
4. Test coverage audit
5. Pre-landing review + adversarial review
6. Version bump + CHANGELOG update
7. Link/create GitHub issues
8. Conventional commit + push + PR creation

## Output

```
✓ Pre-flight: branch feature/auth, 5 commits, +200/-50 lines (mode: official)
✓ Issues: linked #42, created #43
✓ Tests: 42 passed, 0 failed
✓ Review: 0 critical, 2 informational
✓ Version: 1.2.3 → 1.2.4
✓ PR: https://github.com/org/repo/pull/123
```
