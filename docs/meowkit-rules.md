# MeowKit Contribution Rules

Rules derived from the full red-team audit (11 batches, 98 items, 43 critical findings). Every rule exists because a real bug was found. Follow these when adding or modifying agents, skills, hooks, or rules.

---

> Best practice: [Lessons from Building Claude Code: How We Use Skills](./research/lessons-build-skill.md)

## 1. Path Conventions

**Source:** B1-C1, B2-C3, B2-C8, B6-C1, B8-C4

| Path Type               | Canonical Form                                                             | Wrong Forms                                                         |
| ----------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Plan files              | `tasks/plans/YYMMDD-name/plan.md`                                          | `tasks/plans/YYMMDD-name.md` (flat), `plans/`                       |
| Review verdicts         | `tasks/reviews/YYMMDD-name-verdict.md`                                     | `reviews/`, `tasks/plans/.../reports/`                              |
| Sprint contracts        | `tasks/contracts/YYMMDD-HHMM-name-sprint-N.md`                             | `contracts/`, `tasks/plans/.../contracts/`                          |
| Evaluator verdicts      | `tasks/reviews/YYMMDD-name-evalverdict.md`                                 | `evalverdicts/`, separate from review verdict                       |
| Harness runs            | `tasks/harness-runs/YYMMDD-HHMM-name/run.md`                               | `runs/`, `harness/`                                                 |
| Rubric library          | `.claude/rubrics/<name>.md`                                                | `rubrics/`, `.claude/skills/rubric/rubrics/`                   |
| Memory files            | `.claude/memory/lessons.md`                                                | `memory/lessons.md` (bare)                                          |
| Conversation summary    | `.claude/memory/conversation-summary.md`                                   | `memory/conversation-summary.md`, `summary.md`                      |
| Web fetch cache         | `.claude/cache/web-fetches/{YYMMDD}-{HHMMSS}-{host}-{sha256-path[:10]}.md` | `.claude/memory/web-fetches/` (memory is for learnings, not caches) |
| Web fetch manifest      | `.claude/cache/web-fetches/index.jsonl` (append-only)                      | `.claude/memory/web-fetches/index.jsonl`                            |
| Web fetch quarantine    | `.claude/cache/web-fetches/quarantine/{sha256}.quarantined`                | `.claude/memory/quarantine/`, `quarantine/`                         |
| ADR files               | `docs/architecture/adr/YYMMDD-title.md`                                    | `docs/architecture/NNNN-title.md`                                   |
| Session state           | `session-state/` (project root)                                            | `.claude/session-state/`                                            |
| Skill references        | `.claude/skills/*/references/*.md`                                    | `domain/file.md` (short form)                                       |
| Gate validation scripts | `.claude/skills/cook/scripts/validate-gate-*.sh`                      | `scripts/validate-gate-*.sh`                                        |

**Rule:** When referencing any file in a skill or agent, use the FULL path from project root. Never use shortened or assumed paths. Before merging, grep for the path in all consuming files.

---

## 2. Agent Naming

**Source:** B1-C2, B1-M2, B5-C2, B5-C3

### Valid subagent_type Values

#### Core Agents (Global)

These are the MeowKit core agents defined in `.claude/agents/`. Available to all skills:

```
developer, tester, reviewer, planner, documenter, analyst,
researcher, shipper, git-manager, architect, brainstormer,
security, journal-writer, ui-ux-designer, orchestrator,
evaluator
```

> **`evaluator` added 260408** (Phase 3 of harness plan). The `evaluator` is the **behavioral active-verification** counterpart to the structural `reviewer`. Both coexist; they answer different questions. See `.claude/agents/evaluator.md` and `.claude/skills/evaluate/SKILL.md`.

Plus Claude Code built-in types: `Explore`, `Bash`, `general-purpose`, `Plan`

#### Skill-Scoped Agents (Per-Skill)

Skills MAY define their own subagents when the skill requires specialized agent behavior that core agents don't cover. Skill-scoped agents live inside the skill directory:

```
.claude/skills/{skill-name}/
├── SKILL.md
├── agents/                    # Optional: skill-scoped agent definitions
│   ├── {agent-name}.md        # Agent definition (same format as .claude/agents/)
│   └── ...
└── references/
```

**Rules for skill-scoped agents:**
- Agent definition files use the same format as `.claude/agents/*.md` (frontmatter with name, description, model, tools)
- Skill-scoped agents are spawned via `Agent(subagent_type: "general-purpose", prompt: "...")` with the agent definition loaded into the prompt — they do NOT need to be registered in the global `.claude/agents/` directory
- Alternatively, if the skill-scoped agent is reusable across skills, promote it to `.claude/agents/` and add it to the core agents list above
- Skill SKILL.md must document which agents it spawns and why
- Max 3 skill-scoped agents per skill (YAGNI — if you need more, the skill is doing too much)

**When to use skill-scoped vs core agents:**
- Use **core agents** when the agent role exists across many skills (developer, reviewer, researcher)
- Use **skill-scoped agents** when the agent has domain-specific behavior unique to that skill (e.g., a Jira ticket analyzer, a Figma design extractor)

### Mapping Table

| Wrong Name            | Correct Name                               |
| --------------------- | ------------------------------------------ |
| `fullstack-developer` | `developer`                                |
| `code-reviewer`       | `reviewer`                                 |
| `project-manager`     | `planner`                                  |
| `docs-manager`        | `documenter`                               |
| `debugger`            | `researcher` (with mk:investigate skill) |

**Rule:** Before adding an Agent() call, verify the `subagent_type` against the core list above OR confirm a skill-scoped agent definition exists. If neither exists, the call will use a generic agent without specialized instructions.

---

## 3. Hook Registration

**Source:** B1-C5, B5-C1, B11-C1, B11-C2, B11-C3

### settings.json Must Match Hooks on Disk

Every hook in `.claude/hooks/` MUST be registered in `.claude/settings.json`. An unregistered hook is dead code — it never executes regardless of what the docs claim.

### Argument Convention (Phase 7 migration — 260408)

**Canonical convention (per `code.claude.com/docs/en/hooks`):** Claude Code passes hook input as a **JSON object on stdin**, not as positional args. Phase 7 of the harness plan migrated all meowkit hooks to consume stdin via a shared parser shim.

**Canonical parser:** `.claude/hooks/lib/read-hook-input.sh`. Every hook sources this at the top and consumes exported env vars:

```bash
#!/bin/bash
# Source the parser shim (sets HOOK_* env vars from stdin JSON)
if [ -f "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/read-hook-input.sh" ]; then
  . "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/read-hook-input.sh"
fi

# Prefer the stdin-parsed value; fall back to $1 positional for back-compat
FILE_PATH="${HOOK_FILE_PATH:-$1}"
```

**Exported env vars (from `lib/read-hook-input.sh`):**

| Var                    | Source in JSON         | When set                   |
| ---------------------- | ---------------------- | -------------------------- |
| `HOOK_TOOL_NAME`       | `tool_name`            | All tool-use events        |
| `HOOK_FILE_PATH`       | `tool_input.file_path` | Edit, Write, Read matchers |
| `HOOK_COMMAND`         | `tool_input.command`   | Bash matcher               |
| `HOOK_SESSION_ID`      | `session_id`           | All events                 |
| `HOOK_TOOL_USE_ID`     | `tool_use_id`          | Tool-use events            |
| `HOOK_CWD`             | `cwd`                  | All events                 |
| `HOOK_EVENT_NAME`      | `hook_event_name`      | All events                 |
| `HOOK_TRANSCRIPT_PATH` | `transcript_path`      | All events                 |

**Back-compat fallback:** hooks also read `$1` as a fallback so they work in both the old `"$TOOL_INPUT_FILE_PATH"` positional convention (if Claude Code's settings.json parser expands it) AND the canonical stdin convention. If stdin parsing returns empty, `$1` is used. Both conventions coexist safely.

### Performance Rule

**Source:** B11-C3

Never register expensive hooks (test suites, builds) on broad matchers like `Bash`. Gate them by inspecting the input early and exiting 0 for non-matching cases:

```bash
. "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/read-hook-input.sh"
COMMAND="${HOOK_COMMAND:-$1}"

# Only run on git commit/push commands
case "$COMMAND" in
  *"git commit"*|*"git push"*) ;; # run checks
  *) exit 0 ;; # skip
esac
```

---

## 4. Python Scripts

**Source:** B3-M1, B7-C2, B10-C2

**Rule:** ALL python script invocations MUST use the venv interpreter:

```bash
# WRONG
python .claude/scripts/validate.py
python3 .claude/skills/multimodal/scripts/check_setup.py

# RIGHT
.claude/skills/.venv/bin/python3 .claude/scripts/validate.py
.claude/skills/.venv/bin/python3 .claude/skills/multimodal/scripts/check_setup.py
```

The venv is created by `npx mewkit setup`. If it doesn't exist, the `project-context-loader.sh` SessionStart hook warns the user.

---

## 5. Verdict & Review System

**Source:** B4-C1, B4-C2, B4-C3

### Verdict Taxonomy

Use ONLY: **PASS / WARN / FAIL**

Never use: APPROVE, REQUEST CHANGES, BLOCK (these were removed in the audit fix)

### Review Dimensions

The canonical 5 dimensions (matching `step-04-verdict.md`):

1. **Correctness** — no critical/major bugs, logic matches requirements
2. **Maintainability** — clean, readable, follows conventions, type safety
3. **Performance** — no N+1, no blocking async, no unbounded fetches
4. **Security** — passes security-rules.md checklist; security agent BLOCK → automatic FAIL
5. **Coverage** — all acceptance criteria tested, edge cases covered

### Verdict File Location

Always: `tasks/reviews/YYMMDD-name-verdict.md`

---

## 6. Phase Model

**Source:** B2-C6

MeowKit uses a **7-phase** model. All references must use this sequence:

```
Phase 0: Orient → Phase 1: Plan [GATE 1] → Phase 2: Test RED
→ Phase 3: Build → Phase 4: Review [GATE 2] → Phase 5: Ship → Phase 6: Reflect
```

Gate 1: after Phase 1 (human approval required)
Gate 2: after Phase 4 (human approval required, NO EXCEPTIONS)

**Rule:** Never use a 5-phase model. If you see one, fix it. The workflow-orchestrator was migrated from 5-phase to 7-phase in the audit.

---

## 7. Memory System

**Source:** B2-C8, B6-C1, B8-C4, B10-C3

### Always Use `.claude/memory/` Prefix

```
# WRONG
memory/lessons.md
memory/patterns.json
memory/decisions.md

# RIGHT
.claude/memory/lessons.md
.claude/memory/patterns.json
.claude/memory/decisions.md
```

### patterns.json Schema

New entries should include all fields:

```json
{
  "id": "kebab-case-id",
  "type": "success | correction",
  "category": "pattern | decision | failure",
  "severity": "critical | standard",
  "applicable_when": "one sentence condition",
  "scope": "optional/path",
  "context": "when this applies",
  "pattern": "what to do or avoid",
  "frequency": 1,
  "lastSeen": "YYYY-MM-DD"
}
```

Missing `category`/`severity`/`applicable_when` are allowed for backward compatibility. Missing `severity` defaults to `"standard"`.

---

## 8. Skill Structure

**Source:** B3-C3, B8-C2, B8-C3

### Required Structure

```
.claude/skills/{name}/
├── SKILL.md                    # Required: frontmatter + description
├── references/                 # Optional: JIT-loaded reference docs
│   ├── reference-a.md
│   └── reference-b.md
├── prompts/                    # Optional: agent prompts, templates
├── templates/                  # Optional: file templates
├── scripts/                    # Optional: executable scripts
└── data/                       # Optional: CSV, JSON data files
```

### Rules

- Every referenced file MUST exist. grep for paths before merging.
- Use `mk:` prefix in skill names. Never use `ck:` prefix (that's ClaudeKit).
- Reference paths must use full `.claude/skills/*/references/*` form, not short `domain/file.md` form.

---

## 9. Documentation Honesty

**Source:** B9-C2, B9-C3, B11-C1

**Rule:** Never document a feature as "enforced" or "active" if the enforcement mechanism doesn't exist or is incomplete.

| Wrong                                                        | Right                                                                        |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| "This hook blocks X" (hook not registered)                   | "This hook blocks X when registered in settings.json"                        |
| "30 destructive patterns are guarded" (only 8 checked)       | "8 patterns are hook-enforced. Additional patterns are behavioral guidance." |
| "Environment-aware blocking in production" (not implemented) | "Environment-aware blocking is planned but not yet implemented."             |

---

## 10. Pre-Merge Checklist

Before merging any skill, agent, hook, or rule change:

- [ ] All file paths referenced exist (grep every path)
- [ ] All `subagent_type` values are in the valid list (Section 2)
- [ ] All hooks referenced are registered in `settings.json`
- [ ] All python commands use `.claude/skills/.venv/bin/python3`
- [ ] Memory paths use `.claude/memory/` prefix
- [ ] No bare `memory/` or `ck:` references
- [ ] Verdict uses PASS/WARN/FAIL (not APPROVE/BLOCK)
- [ ] Phase model uses 7 phases (not 5)
- [ ] Plan paths use `tasks/plans/YYMMDD-name/plan.md` format
- [ ] New hooks use `$1` for file path (not `$1=tool_name, $2=path`)
- [ ] Documentation claims match actual enforcement
