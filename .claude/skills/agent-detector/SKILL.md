---
name: mk:agent-detector
description: "Picks task agent and complexity tier. NOT for mk:scale-routing."
triggers:
  - every message
  - always first
allowed-tools:
  - Read
source: aura-frog
keywords:
  - agent-routing
  - model-tier
  - phase-0-orient
  - auto-detect
  - complexity-classification
when_to_use: "Auto at workflow start."
user-invocable: false
owner: lifecycle
criticality: medium
status: active
runtime: claude-code
adapted_for: claude-code
requires_external_service: ["jira"]
default_enabled: true
---

# Agent Detector

Once per task, picks the specialist agent to own it, the complexity tier (TRIVIAL, STANDARD
or COMPLEX) and any risk flags, and says so in one line. It is offered on every message;
detect when a task starts or its scope changes, and otherwise reuse the result already given
for the current task: a question, a one-line edit or a follow-up inside the same task needs
no new detection. The domain-to-complexity CSV match is `mk:scale-routing`; this
skill adds the agent and the horizontal risk flags.

## Workflow

0. **Safety baseline precheck (do this first).** Before any other step, scan the context window for the cached-sentinel marker emitted by `safety-sentinel-inject.cjs`:

   ```
   ## Safety baseline: verified (cached, session <id>)
   ```

   If the marker IS present (turns 2..N of the same session): emit
   `Safety baseline: verified (cached)` and SKIP the Read loop below.
   The rules remain in context from the inner harness's `.claude/rules/` auto-load;
   the sentinel only suppresses redundant re-reads.

   If the marker is ABSENT (turn 1 of a new session, OR
   `MEOWKIT_SKIP_SAFETY_SENTINEL=off`): `Read` each of the always-on
   safety/baseline rules — exactly the files in `.claude/rules/`, no more:
   - `.claude/rules/meowkit-core.md`
   - `.claude/rules/security-rules.md`
   - `.claude/rules/injection-rules.md`
   - `.claude/rules/core-behaviors.md`
   - `.claude/rules/development-rules.md`
   - `.claude/rules/agent-conduct.md`

   If any `Read` returns "file does not exist" or equivalent, **ABORT IMMEDIATELY** with the exact message:

   ```
   SAFETY BASELINE INCOMPLETE: rule <name> not found among the always-on rules
   Refusing to route any task. Restore the rule (git checkout / the installer) before retrying.
   ```

   Do NOT proceed to detection. Do NOT route to any agent. Those rules are the deterministic baseline; their absence indicates either repo corruption or a partial install. Replaces the unverified directory-auto-load assumption with a positive existence check.

0a. **Project context.** If `docs/project-context.md` exists, read it before task-specific context; if it is absent, continue without it.

0b. **Routing rules.** Read what the steps below use, once per task: `.claude/skills/cook/references/phase-contracts.md`, `references/agent-routing.md`, `references/model-selection-rules.md` and `references/risk-checklist.md`. If the task names a Jira key or a sprint contract exists, also read `references/agile-story-gates.md`, `agile-sprint-commitment.md` and `agile-feedback-cycle.md`. If one is missing, say so and route from the rest.

1. **Pick the agent.** Choose from the live roster in `references/agent-routing.md` (the files in `.claude/agents/` are authoritative). The Jira and Confluence leaf agents are routed by `mk:jira` and `mk:confluence`, not here. If the user names an agent, use it.
2. **Pick the tier.** Take the `mk:scale-routing` result when it matched a domain; otherwise judge from the size signals in `references/model-selection-rules.md` (that file owns the tier table, the escalation rules and the agent `model:` pins). A `high` level is COMPLEX. Do not downgrade the tier mid-task.
3. **Check risk flags.** Match the task against `references/risk-checklist.md`. Any of AUTH, AUTHZ, DATA_MODEL, AUDIT_SEC or EXT_SYSTEM makes the tier COMPLEX whatever the CSV said.
4. **Report and hand off.** One line: `Agent: <name> | Tier: <tier> | Flags: [<ids>]`, then invoke the skill the task needs (`references/skill-domain-routing.md`; task signals in `references/lifecycle-routing.md`; per-phase read budgets in `references/context-budget-rules.md`).

If the task is too vague to route, say what is missing and ask, rather than guessing an agent.

## Gotchas

- A short message with a domain keyword ("fix the auth token") scores as heavy work even when the change is one line: judge scope as well as keywords, and say the tier you chose so the user can correct it.
- A pivot mid-conversation is a new task: detect again instead of reusing the earlier result.
- A task that spans two domains ("add a security check to the payment UI") needs one primary agent: pick by the dominant concern and name the other as a reviewer.
