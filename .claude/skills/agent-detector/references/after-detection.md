# After Detection

1. **Output detection result** with agent, model, and complexity
2. **Load agent instructions** from `.claude/agents/[agent-name].md`
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
5. **Context is loaded on demand** by the consumer skill via explicit `Read` calls on `.claude/memory/` topic files (`fixes.md`, `review-patterns.md`, `architecture-decisions.md`). `.claude/memory/` is a project convention — it is NOT the Claude Code platform auto-memory at `~/.claude/projects/<project>/memory/`.

---

## Available Agents

Agents at `.claude/agents/`:

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

See `.claude/rules-conditional/agent-routing.md` for full details.

---

## Manual Override

User can force specific agent:

```
User: "Use only tester for this task"
→ Override automatic selection
→ tester becomes PRIMARY regardless of scoring
```

---

**Agent routing:** `.claude/rules-conditional/agent-routing.md` (canonical) and `.claude/agents/orchestrator.md` (orchestrator agent definition)

**MANDATORY:** Always show agent banner at start of EVERY response.
