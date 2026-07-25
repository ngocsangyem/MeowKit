# After Detection

1. **Output detection result** with agent (if any applies), tier, and complexity.
2. **If a Cursor agent applies**, delegate via custom-agent Task delegation to the matching agent definition at `.cursor/agents/<agent-name>.md`.
3. **Invoke appropriate skill:**
   - Complex feature → `mk:workflow-orchestrator` or `mk:cook`
   - Bug fix → `mk:fix`
   - Investigation/debugging → `mk:investigate`
   - Code review → `mk:review`
   - Security audit → `mk:cso`
   - For the full intent → skill dispatch table, see
     `.cursor/skills/agent-detector/references/skill-domain-routing.md` (loaded at Step 0b).
4. **Context is loaded on demand** by the consumer skill via explicit reads of `.meowkit/memory/` topic files (`fixes.md`, `review-patterns.md`, `architecture-decisions.md`). `.meowkit/memory/` is this project's own memory convention — it is NOT any host-runtime platform's built-in auto-memory.

---

## Available Agents

This bundle ships exactly **3 agents** at `.cursor/agents/` — there is no larger role-per-agent roster:

| Agent | Role |
|---|---|
| `explore` | Fast, read-only repo orientation |
| `planner` | Architecture / implementation planning before non-trivial changes |
| `reviewer` | Evidence-ranked review after implementation |

Every other role a larger agent roster might carry (developer, tester, security, shipper, documenter, analyst, ...) is performed directly by the invoked skill (`mk:cook`, `mk:testing`, `mk:review`, `mk:ship`, `mk:document-release`, ...) rather than a dedicated agent — agents here are narrow, read-only helpers a skill calls into, not the primary work unit. Domain-integration agents (Jira, Confluence, etc.) are not part of this bundle's core pack.

See `.cursor/agents/*.md` for each agent's routing-trigger description. Skill dispatch (intent → skill) lives separately in `.cursor/skills/agent-detector/references/skill-domain-routing.md`.

---

## Manual Override

User can force a specific agent:

```
User: "Use only reviewer for this task"
→ Override automatic selection
```

---

**Agent routing:** see `.cursor/agents/*.md` for the 3 agents' frontmatter-declared routing triggers. **Skill dispatch:** `.cursor/skills/agent-detector/references/skill-domain-routing.md`.

**MANDATORY:** Always show agent banner at start of EVERY response.
