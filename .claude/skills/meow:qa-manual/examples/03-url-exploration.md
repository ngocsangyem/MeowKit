# Example 3: URL Exploration (No Spec)

## Input

```
/meow:qa-manual https://app.example.com
```

No spec file — agent explores the app and discovers flows.

## Execution

```
Step 1: meow:playwright-cli goto https://app.example.com
Step 2: meow:playwright-cli snapshot → discover page structure

Discovered flows:
  1. Navigation: Home → Products → Product Detail
  2. Search: Search bar → results → click result
  3. Auth: Login link → login page (auth required)
  4. Footer: Contact → About → Terms links

Step 3: Test each discovered flow...

Flow 1 (Navigation): goto /products → click first product → verify detail page
  → PASS

Flow 2 (Search): fill search "widget" → click result → verify product page
  → PASS

Flow 3 (Auth): click Login → ⚠️ Authentication required
  User chose: skip
  → SKIPPED

Flow 4 (Footer links): click Contact → verify loads
  → PASS
```

## Output

```markdown
## QA Manual Test Report

**Spec:** https://app.example.com (exploratory)
**Tested at:** 2026-03-27 15:00 UTC
**Browser:** Chromium via playwright-cli
**Base URL:** https://app.example.com

### Flow Results

| Flow | Steps | Passed | Failed | Skipped | Status |
|------|-------|--------|--------|---------|--------|
| Navigation | 3 | 3 | 0 | 0 | PASS |
| Search | 3 | 3 | 0 | 0 | PASS |
| Auth (Login) | 1 | 0 | 0 | 1 | SKIPPED |
| Footer Links | 3 | 3 | 0 | 0 | PASS |

### Skipped Flows

| Flow | Reason |
|------|--------|
| Auth (Login) | Authentication — user chose skip |

### Summary

Total flows: 4 | Passed: 3 | Failed: 0 | Skipped: 1
**Verdict:** PASS (all non-skipped flows passed)
```
