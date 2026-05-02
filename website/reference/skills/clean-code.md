---
title: "mk:clean-code"
description: "Pragmatic coding standards — KISS, DRY, YAGNI, SRP. For ad-hoc quality reviews, not post-hoc diff review or behavior-preserving simplification."
---

# mk:clean-code

Enforces KISS/DRY/YAGNI/SRP during authoring and ad-hoc quality reviews. Pragmatic standards: concise, direct, no unnecessary comments. NOT for post-hoc diff/PR review (use `mk:review`); NOT for behavior-preserving simplification (use `mk:simplify`).

## Core principles

| Principle | Rule |
|---|---|
| SRP | Single Responsibility — each function/class does ONE thing |
| DRY | Don't Repeat Yourself — extract duplicates, reuse |
| KISS | Keep It Simple — simplest solution that works |
| YAGNI | You Aren't Gonna Need It — don't build unused features |
| Boy Scout | Leave code cleaner than you found it |

## Process

1. Read existing code — understand structure before changing
2. Check dependencies — what imports this file? what tests cover it?
3. Apply coding standards from `references/coding-standards.md`
4. Self-check — goal met? all files edited? code works? nothing forgotten?
5. Run verification scripts

## Summary

| Do | Don't |
|---|---|
| Write code directly | Write tutorials |
| Let code self-document | Add obvious comments |
| Fix bugs immediately | Explain the fix first |
| Inline small things | Create unnecessary files |
