---
name: meow:clean-code
description: "Use when reviewing code for quality, enforcing KISS/DRY/YAGNI principles, or cleaning up over-engineered abstractions. Pragmatic standards: concise, direct, no unnecessary comments."
allowed-tools: Read, Write, Edit
version: 2.0
priority: CRITICAL
source: antigravity-kit
author: vudovn (antigravity-kit)
---

# Clean Code — Pragmatic AI Coding Standards

> Be **concise, direct, and solution-focused**.

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
