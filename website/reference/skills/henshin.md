---
title: "mk:henshin"
description: "Transform existing code into agent-consumable surfaces — CLI (npm-publishable), MCP server, and companion skill."
---

# mk:henshin

## What This Skill Does

Henshin analyzes existing code and produces a **Transformation Spec** -- a planning document that defines which capabilities to expose as agent tools, what shape each CLI command and MCP tool should take, and how the three surfaces (CLI + MCP + companion skill) share a common core. Henshin is a planning skill, not a builder -- the actual scaffold, wrap, test, docs, and publish steps happen downstream in `mk:plan-creator` and `mk:cook`.

## When to Use

Triggers:
- "agentize this module", "expose as MCP", "wrap as CLI", "publish to npm"
- "make this LLM-accessible", "turn into agent tool", "expose feature as tool"
- "henshin <module>", "wrap <module> for agents"

Anti-triggers:
- Building new code from scratch -- use `mk:bootstrap`
- Reviewing or verifying existing code -- use `mk:review`
- Porting features FROM external repos -- use `mk:chom`
- Raw npm scaffolding without an agent-use story

## Core Capabilities

- **Codebase recon via `mk:scout`** -- architecture fingerprint, entry points, dependency graph
- **Capability inventory** -- catalogs entry points, inputs/outputs, side effects, secrets, runtime, existing tests
- **Agent-centric design** -- applies design rules: workflows over endpoints, context economy, actionable errors, safe/mutating/destructive classification, idempotency
- **3-surface design** -- shared `core/` package, `cli/` (commander, npm-publishable), `mcp/` (stdio/SSE/Streamable HTTP, Cloudflare Workers + Docker)
- **6-tier credential resolution chain** -- explicit flag > env var > dotenv > user config > project config > OS keychain
- **7-question challenge interview** -- HARD GATE with business-decision gates (package name, license, ownership always require human input)
- **Capability cut pass** -- scores each capability on Agent value and CLI value; drops those with both LOW

## Arguments

| Flag | Effect |
|------|--------|
| `--both` _(default)_ | Monorepo: shared `core/`, `cli/` package, `mcp/` package, companion skill |
| `--mcp` | MCP server only (core retained for future CLI) |
| `--cli` | CLI only (core retained for future MCP) |
| `--auto` _(default)_ | Autonomous decisions with one-line justifications. Still gates on package name, license, ownership. |
| `--ask` | Present the 7-question challenge interview to the user before emitting the spec. |
| `--lean` | Skip researcher agent background gathering. Scout still runs. HARD GATE still enforced. |

## Workflow

```
[1. Recon] -> [2. Inventory] -> [3. Agentize Map] -> [4. Challenge] == HARD GATE == [5. Transformation Spec] -> [6. Handoff]
```

1. **Recon** -- Read `docs/project-context.md`, run `mk:scout` on target, optionally invoke researcher agent for ecosystem context.
2. **Inventory** -- Catalog entry points, capabilities (5-15 worth exposing), inputs/outputs, side effects, config surface, secrets, runtime.
3. **Agentize Map** -- Apply agent-centric design rules. Consolidate workflows. Classify safe/mutating/destructive. Design all three surfaces.
4. **Challenge (HARD GATE)** -- 10-decision matrix covering output mode, capability cuts, transports, credentials, deployment, CLI framework, test runner, package name, license, ownership. **Human approval required.** Stops if <5 capabilities or >=5 red flags.
5. **Transformation Spec** -- Structured planning document: source, surfaces, capability cut list, credentials/auth, deployment targets, decision matrix, risks, out of scope.
6. **Handoff** -- Emits spec and suggests next command: `/mk:plan-creator "Agentize <module>"`.

## Usage

```bash
/mk:henshin src/auth --both --auto
/mk:henshin packages/api --mcp --ask
/mk:henshin src/cli-tools --cli --lean
```

## Example Prompt

```
/mk:henshin packages/data-pipeline --both --ask
"The pipeline has 12 public functions. I want to expose the 5 that agents would actually use."
```

## Common Use Cases

- Wrapping an internal service as an MCP server so AI agents can query it
- Publishing a CLI tool to npm for human scripting workflows
- Building all three surfaces (CLI + MCP + skill) from a single shared core for an open-source project
- Evaluating whether a codebase is ready for agentization before committing to the work
- Designing the credential resolution model for tools that need API keys

## Pro Tips

- **`--both` is the default for a reason.** Designing all three surfaces up front with a shared core is far cheaper than adding MCP later when CLI was built standalone.
- **Be aggressive about capability cuts.** The #1 mistake is wrapping every public function. 8 sharp tools beat 40 mirror tools.
- **Workflows, not endpoints.** If the README says "first call X, then Y, then Z", that is ONE tool. Design at the user-outcome level.
- **Henshin emits a spec, not code.** If you expected code after running this skill, run `/mk:plan-creator` followed by `/mk:cook`.
- **Package name, license, ownership are always human decisions.** Even in `--auto` mode. Bad defaults cause legal and naming conflicts expensive to unwind post-publish.

> **Canonical source:** `.claude/skills/henshin/SKILL.md`
