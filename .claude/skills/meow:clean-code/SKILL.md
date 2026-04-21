---
name: meow:clean-code
description: "Enforces KISS/DRY/YAGNI during authoring and ad-hoc quality reviews. Pragmatic standards: concise, direct, no unnecessary comments. NOT for post-hoc diff/PR review (see meow:review); NOT for behavior-preserving simplification passes (see meow:simplify)."
allowed-tools: Read, Write, Edit
version: 2.0
priority: CRITICAL
phase: on-demand
trust_level: third-party
injection_risk: low
source: antigravity-kit
---

# Clean Code — Pragmatic AI Coding Standards

> Be **concise, direct, and solution-focused**.

> For post-implementation complexity reduction within the current diff (Phase 3.5 workflow), use `meow:simplify`. `meow:clean-code` is for broader quality-standards enforcement at any phase.

## Core Principles

| Principle     | Rule                                                       |
| ------------- | ---------------------------------------------------------- |
| **SRP**       | Single Responsibility — each function/class does ONE thing |
| **DRY**       | Don't Repeat Yourself — extract duplicates, reuse          |
| **KISS**      | Keep It Simple — simplest solution that works              |
| **YAGNI**     | You Aren't Gonna Need It — don't build unused features     |
| **Boy Scout** | Leave code cleaner than you found it                       |

## Process

1. **Read existing code** — understand structure before changing
2. **Check dependencies** — what imports this file? what tests cover it?
3. **Apply coding standards** — load `references/coding-standards.md` for detailed rules
4. **Self-check** — goal met? all files edited? code works? no errors? nothing forgotten?
5. **Run verification** — execute agent-appropriate scripts from references

## References

| Reference                                                   | When to load                | Content                                                           |
| ----------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------- |
| **[coding-standards.md](./references/coding-standards.md)** | Step 3 — applying standards | Naming, functions, structure, anti-patterns, verification scripts |

## Summary

| Do                     | Don't                     |
| ---------------------- | ------------------------- |
| Write code directly    | Write tutorials           |
| Let code self-document | Add obvious comments      |
| Fix bugs immediately   | Explain the fix first     |
| Inline small things    | Create unnecessary files  |
| Name things clearly    | Use abbreviations         |
| Keep functions small   | Write 100+ line functions |

> The user wants working code, not a programming lesson.

## Gotchas

- **Over-abstracting simple code**: Creating helpers for one-time operations violates YAGNI → Three similar lines are better than a premature abstraction
- **Removing error handling deemed unnecessary**: Stripping try-catch from system boundaries loses resilience → Only remove error handling for internal calls with guaranteed contracts
