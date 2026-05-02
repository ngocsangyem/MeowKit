---
title: "mk:chom"
description: "Analyze external systems, repos, apps, or ideas and produce a spec for replicating them in your project."
---

# mk:chom

## What This Skill Does

Chom analyzes external codebases, web apps, or described ideas to produce a **Replication Spec** -- a structured decision document that answers whether and how to replicate the feature in your project. It runs through a 6-phase workflow ending at a HARD GATE that requires human approval before any code is written. Chom does NOT write code; it produces a spec for downstream skills (`mk:plan-creator`, `mk:cook`) to implement.

## When to Use

Triggers:
- "copy this from X", "replicate this feature", "clone how Y does Z", "port from", "build like X"
- "how does X do Y", "compare X vs our approach"

Anti-triggers:
- Packing the current project for export -- use `mk:pack`
- One-shot URL-to-markdown fetches -- use `mk:web-to-markdown`
- Exploring your own codebase architecture -- use `mk:scout`

## Core Capabilities

- **Multi-source input routing** -- git repos (shallow clone + scout), web URLs (fetch + browse), local paths (direct read), freeform text (researcher agent)
- **6-phase analysis workflow** with a non-bypassable HARD GATE at Phase 4
- **4 adaptation modes**: `--compare` (side-by-side only), `--copy` (minimum changes), `--improve` (replace anti-patterns), `--port` (idiomatic rewrite)
- **Structured challenge framework** -- 7 questions scoring necessity, stack fit, data model, dependency cost, effort/value, blast radius, and maintenance burden
- **Risk scoring** -- 0-2 reds = low (proceed), 3-4 = medium (resolve first), 5+ = high (reject)
- **Escalation for complex flows** -- 3+ architectural layers trigger a handoff to `mk:sequential-thinking` before continuing

## Arguments

| Flag | Effect |
|------|--------|
| `--compare` | Side-by-side analysis only (phases 1-3). No decision or handoff. |
| `--copy` | Bias toward minimum-adaptation transplant. Focuses on compatibility gaps. |
| `--improve` | Bias toward replacing anti-patterns during port. |
| `--port` | Bias toward idiomatic rewrite for your stack. |
| `--lean` | Skip researcher agent background gathering. HARD GATE still enforced. |
| `--auto` | Auto-approve non-HARD-GATE steps. HARD GATE still requires human approval. |

No flag: full 6-phase workflow, emits Replication Spec without declaring adaptation depth.

## Workflow

```
[1. Recon] -> [2. Map] -> [3. Analyze] -> [4. Challenge] == HARD GATE == [5. Decision] -> [6. Handoff]
```

1. **Recon** -- Route input by type (git clone/scout, web fetch, local read, researcher agent). Always read `docs/project-context.md` for your stack.
2. **Map** -- Build dependency matrix: source components mapped to local equivalents (EXISTS / NEW / CONFLICT).
3. **Analyze** -- Trace execution flow, data model, API contracts, UX patterns. Mode-specific focus for `--copy`/`--improve`/`--port`.
4. **Challenge** -- Load `references/challenge-framework.md`. Ask 7 questions. Score risk. Present decision matrix. **Human approval required.**
5. **Decision** -- Go/no-go. If go: formalize Replication Spec. If no-go: Rejection Report.
6. **Handoff** -- Output spec with risk score, red flag summary, and suggested next command.

## Usage

```bash
/mk:chom https://github.com/vercel/ai --port
/mk:chom "copy the dark mode toggle from linear.app" --compare
/mk:chom ./path/to/local/repo --copy --lean
```

## Example Prompt

```
/mk:chom https://github.com/shadcn-ui/ui --improve "We want their component composition pattern but adapted for MUI instead of Radix"
```

## Common Use Cases

- Evaluating whether to replicate a competitor's feature before building
- Porting an open-source library's pattern into your stack idiomatically
- Side-by-side architectural comparison of two approaches
- Pre-build validation: does this feature fit our stack, or should we reject it?
- Understanding how an external system solves a problem before designing your own

## Pro Tips

- **Always pass a mode flag.** No-flag runs work but don't bias analysis toward your intent. If you know you want to port, say `--port`.
- **Read `docs/project-context.md` first.** Without it, chom gives generic advice that won't fit your stack.
- **HARD GATE is your safety net.** The challenge phase catches stack mismatches, hidden dependencies, and maintenance burdens that look obvious in hindsight.
- **`--compare` is cheap.** When unsure about replication, run `--compare` first to see the head-to-head before committing to a full spec.
- **Chom never chains into other skills.** Handoff text tells you what to run next (`mk:plan-creator`, `mk:sequential-thinking`). You invoke it.

> **Canonical source:** `.claude/skills/chom/SKILL.md`
