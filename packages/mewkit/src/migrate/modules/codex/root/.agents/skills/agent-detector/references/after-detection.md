# After Detection

1. **Output detection result** with agent, model, and complexity
2. **Load agent instructions** from `.codex/agents/[agent-name].md`
3. **Use detected model** when spawning Agent tool:
   ```
   Agent(subagent_type="[agent]", model="[detected-model]", ...)
   ```
4. **Invoke appropriate skill:**
   - Complex feature → `mk:workflow-orchestrator` or `mk:cook`
   - Bug fix → `mk:fix`
   - Investigation/debugging → `mk:investigate`
   - Code review → `mk:review`
   - Security audit → `mk:cso`
   - For the full intent → skill dispatch table, see
     `.agents/skills/agent-detector/references/skill-domain-routing.md` (loaded at Step 0b).
5. **Context is loaded on demand** by the consumer skill via explicit `Read` calls on `.meowkit/memory/` topic files (`fixes.md`, `review-patterns.md`, `architecture-decisions.md`). `.meowkit/memory/` is a project convention — it is NOT the host-runtime platform auto-memory at `~/.codex/projects/<project>/memory/`.

---

## Available Agents

Agents at `.codex/agents/`:

```toon
core_agents[6]{category,count,list}:
  Planning,3,orchestrator/planner/architect
  Development,2,developer/evaluator
  Quality & Security,3,tester/reviewer/security
  Operations,4,shipper/git-manager/documenter/project-manager
  Analysis,3,analyst/researcher/brainstormer
  Design & Failure,2,ui-ux-designer/journal-writer
domain_agents[2]{family,count,list}:
  Jira,16,jira-issue/jira-search/jira-lifecycle/jira-collaborate/jira-relationships/jira-time/jira-agile/jira-fields/jira-bulk/jira-jsm/jira-admin/jira-dev/jira-ops/jira-evaluator/jira-estimator/jira-analyst
  Confluence,5,confluence-page/confluence-search/confluence-spec-analyst/confluence-bulk/confluence-collaborate
```

Total: 17 core + 21 domain = 38 agents. Core agents are routed by the orchestrator via the `agent-routing.md` table; domain agents are routed by their hub skill (`mk:jira` / `mk:confluence`) — the orchestrator does NOT score them directly.

See `.agents/skills/rule-agent-routing.md` for the full agent table. Skill dispatch (intent → skill) lives separately in `.agents/skills/agent-detector/references/skill-domain-routing.md`.

---

## Manual Override

User can force specific agent:

```
User: "Use only tester for this task"
→ Override automatic selection
→ tester becomes PRIMARY regardless of scoring
```

---

**Agent routing:** `.agents/skills/rule-agent-routing.md` (canonical agent table) and `.codex/agents/orchestrator.md` (orchestrator agent definition). **Skill dispatch:** `.agents/skills/agent-detector/references/skill-domain-routing.md`.

**MANDATORY:** Always show agent banner at start of EVERY response.
