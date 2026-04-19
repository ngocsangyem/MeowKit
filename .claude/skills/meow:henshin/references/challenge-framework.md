# Challenge Framework

Used in Phase 4 (HARD GATE) of `meow:henshin`. Pressure-tests assumptions, surfaces constraints, cuts scope. Phase 5 does not emit until these questions have answers.

## 7-question interview

Always ask, in this order. Skip only if Phase 2 + 3 already produced a definitive answer (record the inferred answer + source instead).

1. **Why agentize this?** What unlocks when an AI agent (not a human) calls these operations? If the answer is "it would be cool", stop.
2. **Who is the primary consumer?** AI agent, human via CLI, or both equally? Drives output shape, error prose, verbosity defaults.
3. **What is v1?** Name the 3–5 capabilities that ship in week 1. Everything else is v2.
4. **Read vs write split.** Which capabilities are read-only, which mutate, which are destructive? Drives tool classification (safe / mutating / destructive) and auth requirements per MCP transport.
5. **Where do credential values come from today?** Env? Vault? Hardcoded? Interactive OAuth? Pins the resolution-chain defaults and decides whether the interactive keychain layer is needed.
6. **Deployment target.** Local only (stdio + CLI)? Remote (Cloudflare Workers)? Self-host (Docker)? All? Drives cost, ops burden, and which transports must be implemented.
7. **Package name, scope, license, maintenance ownership.** These are business decisions — always confirm with human input, never auto-decide, even in `--auto`.

## Architectural red/green check

| Question | Red flag | Green flag |
|---|---|---|
| Can core be extracted cleanly? | Business logic tangled with HTTP/CLI framework code | Clear function boundaries, no framework imports in domain code |
| Side effects localized? | Scattered across modules | Isolated into client classes / effect boundaries |
| Async / long-running? | 30+ sec calls with no cancel path | Quick calls, or streaming progress with cancel support |
| Auth complexity? | Multi-step OAuth dance per call | Static token or one-time `login` |
| Output size? | Megabyte payloads typical | Pageable, filterable, default <1 KB |
| Stateful workflows? | Requires client-side state machine | Each call self-contained |

≥3 red flags: recommend refactor first (not agentization).

## Scope-cut pass

For each proposed capability, ask:

- Can an agent accomplish the user's goal **without** this one?
- Is this 80%+ covered by another capability already in the list?
- Does this leak internal model details the agent does not need?
- Is this a debug / admin op that should not be on the public surface?

If "yes" to any: cut the capability. Err on the side of fewer, sharper tools.

## Design red/green check

- **Mirroring HTTP endpoints** instead of designing workflows → red
- **Concise response actually concise** (<1 KB typical) → green
- **Errors tell the agent what to do next** (not just what broke) → green
- **Identifiers agent-friendly** (names) vs DB-friendly (UUIDs) → prefer names
- **Tool descriptions pass the "when would I use this?" test** for a first-time reader → green

## HARD GATE decision matrix (Phase 4 output)

Fill every row. Empty rows block the gate.

```markdown
| # | Decision | Options | Chosen | Rationale |
| - | -------- | ------- | ------ | --------- |
| 1 | Output mode | --both / --mcp / --cli | ? | ? |
| 2 | Capability cut list | N kept / M cut | ? | ? |
| 3 | Transport set (if MCP) | stdio / sse / streamable-http / all | ? | ? |
| 4 | Credential resolution layers enabled | all 6 / env+keychain / env only | ? | ? |
| 5 | Deployment target (if MCP) | Cloudflare / Docker / PaaS / all | ? | ? |
| 6 | CLI framework | commander / cac | ? | ? |
| 7 | Test runner | vitest / jest | ? | ? |
| 8 | Package name + scope | @<org>/<tool> | user-supplied | (business) |
| 9 | License | MIT / Apache-2.0 / proprietary | user-supplied | (business) |
| 10 | Post-release ownership | role or individual | user-supplied | (business) |
```

Decisions 8–10 are **always** user-supplied, even in `--auto`. These are business decisions, not technical ones; bad defaults here cause legal and naming conflicts expensive to unwind post-publish.

## Stop conditions

Abort and propose alternatives if **any** of these hold:

- Core cannot be extracted without significant refactor that the user has not scoped
- No capabilities survive the cut-scope pass
- Credentials model requires interactive OAuth that cannot run in any MCP transport
- Legal / compliance blocks publishing (licensing of upstream deps, export restrictions, etc.)
- `≥5` architectural red flags (signals deep refactor, not agentization)

Emit a Rejection Report with which condition tripped and a concrete refactor recommendation. Do not proceed to Phase 5.

## Gotchas

- **"Why agentize this?" is the most-skipped question and the most-predictive.** If the answer is fuzzy, the spec will be fuzzy and the resulting tools will be noise. Push for a concrete user outcome before continuing.
- **Ambiguous read/write classification kills MCP safety.** Any capability whose side effects are "mostly read, but sometimes writes when X" must be split into two tools (read-only + mutating variant). MCP clients decide confirmation semantics based on the classification.
- **Business decisions leak into `--auto` mode.** Package name, license, ownership are business decisions; even in `--auto`, always gate on human input. Auto-picked names cause `npm publish` failures or legal disputes; auto-picked licenses cause compliance gaps.
- **Red flag count is not additive across categories.** 3 architectural red flags is a deeper problem than 3 design red flags. Weight architectural reds higher when deciding to recommend refactor.
- **Stop conditions are not soft warnings.** When one trips, the right answer is "abort + Rejection Report", not "warn and proceed". The skill's job is to produce a good spec or no spec, never a bad spec.
