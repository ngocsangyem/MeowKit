---
title: journal-writer
description: "Failure documentation agent that captures root cause analyses, lessons learned, and prevention strategies with brutal honesty."
---

# journal-writer

Failure documentation agent that captures root cause analyses, lessons learned, and prevention strategies with brutal honesty.

## Overview

The journal-writer activates when things go wrong. It documents failures with brutal honesty: what happened, what was tried, what the root cause was, and how to prevent it next time. It never sugarcoats — if the architecture was wrong, it says so. If testing was inadequate, it says so. Entries are saved to `docs/journal/` and feed into the analyst's pattern extraction.

## Quick Reference

### Documentation & Management

| Activation trigger | Severity |
|-------------------|----------|
| Test suite fails after 3 fix attempts | High |
| Critical bugs found in production | Critical |
| Security vulnerabilities discovered | Critical |
| Architectural decisions proving problematic | High |
| Major refactoring stalls | Medium |
| Integration failures between components | High |

### Journal Entry Structure

Every entry MUST include: Title, Date, Severity, Component, Status, What Happened (facts), The Brutal Truth (honest assessment), What Was Tried (numbered), Root Cause, Lessons Learned, Next Steps.

## How to Use

The journal-writer activates automatically on escalation paths:

```
Developer fails 3 self-heal attempts → journal-writer documents the failure
Security agent issues BLOCK → journal-writer documents the vulnerability
Reviewer issues FAIL repeatedly → journal-writer documents the pattern
```

## Under the Hood

### Handoff Example

```
Journal entry: docs/journal/260327-auth-token-refresh-race-condition.md

Severity: High
Component: auth/middleware
Status: Resolved

What Happened:
  Session tokens expired during refresh, causing 401 loops

The Brutal Truth:
  Token refresh was added as an afterthought without considering
  concurrent request scenarios. Integration tests would have caught this.

What Was Tried:
  1. Added mutex lock (failed — distributed system)
  2. Added retry with backoff (failed — race still possible)
  3. Implemented token refresh queue (succeeded)

Root Cause:
  No request deduplication for token refresh. Multiple concurrent
  requests each triggered independent refresh attempts.

Lessons Learned:
  - Always consider concurrent access when adding auth middleware
  - Integration tests for auth flows, not just unit tests
  - Token refresh needs request coalescing pattern

  → Feeds into analyst's pattern extraction
```

### Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Journal seems harsh | By design — brutal honesty is the point | Entries focus on prevention, not blame |
| No journal written for a failure | Escalation path not triggered | Manually request: "document what went wrong with [issue]" |
| Sensitive info in journal | Must never include credentials/keys | Journal-writer enforces — redacts automatically |
