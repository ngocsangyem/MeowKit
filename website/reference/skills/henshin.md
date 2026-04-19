---
title: "meow:henshin"
description: "Transform existing code into agent-consumable surfaces — CLI (npm-publishable), MCP server (stdio/SSE/Streamable HTTP), and a companion skill. Planning front door, not a builder."
---

# meow:henshin

Transform existing code into agent-consumable surfaces. Produces a **Transformation Spec**: which capabilities to expose, what shape each surface should take, and how CLI + MCP + companion skill share a common core. Hands off to `meow:plan-creator` → `meow:cook` for the actual build.

## What This Skill Does

`meow:henshin` analyzes an existing module, library, or product feature and answers four questions:

1. Which capabilities are worth exposing to agents?
2. What should each surface look like — CLI commands, MCP tools, skill invocation patterns?
3. How do the three surfaces share one core, with thin adapters?
4. What are the package name, license, and ownership defaults — and which of these require a human decision?

The output is a Transformation Spec that `meow:plan-creator` turns into a multi-phase implementation plan.

## Core Capabilities

- **6-phase planning workflow** — Discover → Inventory → Capability Map → HARD GATE → Spec Write → Handoff
- **Principles** — shared core, thin adapters | workflows-not-endpoints | spec-not-code | hand off, don't orchestrate
- **HARD GATE at Phase 4** — non-bypassable human approval for package name, license, ownership (business decisions)
- **Memory write** — architectural decision record appended to `.claude/memory/architecture-decisions.md` with `##decision:` prefix
- **5 progressive-disclosure references** — agent-centric design, auth resolution, MCP transports, monorepo layout, challenge framework
- **Boundary-respecting** — outbound transformation only; inbound external-repo work routes to `meow:chom`

## When to Use This

::: tip Use meow:henshin when...

- You have a library, service, or feature you want LLMs/agents to call as tools
- You're deciding whether CLI, MCP, or both makes sense for an existing codebase
- You need to design the public agent API (tool names, argument shapes, workflow boundaries) before writing code
- You want to publish a wrapped version to npm and expose an MCP server in one coherent package

:::

::: warning Do NOT use meow:henshin when...

- The source is an **external** repo and you want to port it in → use `/meow:chom`
- You're building an MCP server from scratch with no pre-existing code → use `/meow:skill-creator` + `/meow:plan-creator` from a blank spec
- You just want to `npm publish` without an agent-use story → use `/meow:ship` directly
- You need the actual scaffolder, wrap, test, docs, and publish steps — henshin hands off; execution is owned by `/meow:plan-creator` → `/meow:cook`

:::

## Usage

```bash
# Full 6-phase workflow
/meow:henshin [feature-or-module]

# Pick a surface subset
/meow:henshin auth --cli             # CLI only
/meow:henshin billing --mcp          # MCP server only
/meow:henshin reports --both         # default — all three surfaces

# Interaction style
/meow:henshin feature --auto         # auto-approve technical defaults (name/license/ownership still gated)
/meow:henshin feature --ask          # explicit 7-question interview

# Lean mode — skip optional references, keep HARD GATE
/meow:henshin feature --lean
```

## Workflow

```
[1. Discover] → [2. Inventory] → [3. Capability Map] → [4. Challenge] ══ HARD GATE ══ [5. Spec Write] → [6. Handoff]
```

| Phase | What Happens |
|---|---|
| 1. Discover | Read `docs/project-context.md`; identify target module, current entry points, existing tests |
| 2. Inventory | Enumerate public exports, side effects, dependencies, and auth touchpoints |
| 3. Capability Map | Score each capability on agent-usefulness (frequency, workflow-fit, idempotency, error surface); pick the slice worth exposing |
| 4. Challenge | Package name availability, license compatibility, ownership/maintenance defaults, transport choices. **Human approval required.** |
| 5. Spec Write | Emit Transformation Spec; append `##decision:` record to `.claude/memory/architecture-decisions.md` |
| 6. Handoff | Hand off to `/meow:plan-creator` with the spec attached; henshin does not invoke downstream skills itself |

::: warning Hard Gate
Phase 4 (Challenge) must complete and get explicit human approval before Phase 5 (Spec Write). Non-bypassable — `--auto` and `--lean` both still gate at Phase 4 for package name, license, and ownership. Technical defaults (transport, runtime, auth scheme) may auto-resolve in `--auto`; business decisions never do.
:::

## Output: Transformation Spec

```markdown
# Transformation Spec: [Feature/Module Name]

## 1. Source — local path, language, existing surface
## 2. Capabilities — which to expose, which to hide, which to refactor
## 3. Surface Design
   - CLI: command names, flags, exit codes
   - MCP: tool names, argument schemas, transport matrix
   - Skill: invocation patterns, boundary rules
## 4. Shared Core — contract between surfaces and underlying code
## 5. Package & Release — name, license, versioning, ownership
## 6. Risks — auth gaps, side-effect surface, transport edge cases
## 7. Handoff — next command: /meow:plan-creator [spec-path]
```

::: info Skill Details
**Phase:** on-demand
**Type:** planning front door
**Modes:** `--both` (default) / `--cli` / `--mcp` · `--auto` / `--ask` · `--lean`
**Trust:** kit-authored · **Injection risk:** low
**Source:** adapted from [`claudekit-engineer/agentize`](https://github.com/ngocsangyem/MeowKit)
:::

## Boundary Rules

henshin emits a Transformation Spec and a handoff directive. It does **NOT** invoke `/meow:plan-creator`, `/meow:cook`, `/meow:skill-creator`, or `/meow:ship` mid-flow.

This is henshin's design choice, not a MeowKit platform rule. The downstream skills own multi-phase workflows of their own; interleaving them inside henshin's HARD GATE discipline would corrupt phase ownership on both sides. henshin's job ends at Phase 6 Handoff; the user invokes the next skill.

## henshin vs chom — the boundary

| Axis | `meow:henshin` | `meow:chom` |
|---|---|---|
| Direction | **Outbound** — local code → agent surfaces | **Inbound** — external source → local project |
| Source | A module in *this* repo | A GitHub repo, web URL, screenshot, or freeform idea |
| Output | Transformation Spec (CLI + MCP + skill shape) | Replication Spec (what to build locally) |
| HARD GATE | Package name / license / ownership | Challenge questions + risk score |
| Next step | `/meow:plan-creator` → `/meow:cook` | `/meow:plan-creator` → `/meow:cook` |

They move code in **opposite directions** and share no semantic overlap.

## Gotchas

- **Not a builder.** henshin writes a spec. If you want code, chain `/meow:plan-creator` + `/meow:cook` after handoff.
- **HARD GATE is non-bypassable.** `--auto` decides transport, runtime, auth scheme; it never decides package name, license, or ownership.
- **External repo? Wrong tool.** Paste a GitHub URL and henshin will redirect you to `/meow:chom`.
- **Write to stdout in MCP stdio mode corrupts the protocol.** Every `console.log` in stdio-reachable code is a bug — henshin's `mcp-transports.md` reference documents the rule.
- **Session IDs must be UUIDs.** Sequential session IDs enable cross-session hijacking under weak auth.
- **One server, three transports — test each.** A tool that works in stdio but fails in Streamable HTTP is the most common regression.
- **Reference files are under 200 lines each** per the MeowKit file-size rule — progressive disclosure, not a monolith.

## References

Progressive-disclosure references load per phase:

- `references/agent-centric-design.md` — capability scoring and workflow-fit heuristics (Phase 3)
- `references/auth-resolution-chain.md` — env → config → keychain credential resolution (Phase 3)
- `references/mcp-transports.md` — stdio / SSE / Streamable HTTP adapter patterns (Phase 3–4)
- `references/monorepo-layout.md` — pnpm workspace, package.json, publish config (Phase 4)
- `references/challenge-framework.md` — HARD GATE question set (Phase 4)

## Related

- [`meow:chom`](/reference/skills/chom) — inbound counterpart (external → local)
- [`meow:plan-creator`](/reference/skills/plan-creator) — downstream: turns Spec into phased plan
- [`meow:cook`](/reference/skills/cook) — downstream: executes the plan
- [`meow:skill-creator`](/reference/skills/skill-creator) — for building the companion skill from the spec
- [`meow:ship`](/reference/skills/ship) — downstream: publishes the npm package
- [What's New in v2.5.1](/guide/whats-new#v2-5-1-meow-henshin-2026-04-20)
