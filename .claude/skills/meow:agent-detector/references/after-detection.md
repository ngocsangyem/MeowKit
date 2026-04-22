# After Detection

1. **Output detection result** with agent, model, and complexity
2. **Load agent instructions** from `.claude/agents/[agent-name].md`
3. **Use detected model** when spawning Agent tool:
   ```
   Agent(subagent_type="[agent]", model="[detected-model]", ...)
   ```
4. **Invoke appropriate skill:**
   - Complex feature → `meow:workflow-orchestrator` or `meow:cook`
   - Bug fix → `meow:fix`
   - Investigation/debugging → `meow:investigate`
   - Code review → `meow:review`
   - Security audit → `meow:cso`
5. **Context is loaded on demand** by the consumer skill via explicit `Read` calls on `.claude/memory/` topic files (`fixes.md`, `review-patterns.md`, `architecture-decisions.md`). `.claude/memory/` is a project convention — it is NOT the Claude Code platform auto-memory at `~/.claude/projects/<project>/memory/`.

---

## Available Agents

Agents at `.claude/agents/`:

```toon
agents[5]{category,count,list}:
  Planning,3,orchestrator/planner/architect
  Development,1,developer
  Quality & Security,3,tester/reviewer/security
  Operations,3,shipper/documenter/project-manager
  Analysis,3,analyst/researcher/brainstormer
```

See `.claude/agents/AGENTS_INDEX.md` for full details.

---

## Manual Override

User can force specific agent:

```
User: "Use only tester for this task"
→ Override automatic selection
→ tester becomes PRIMARY regardless of scoring
```

---

**Agent routing:** `.claude/agents/orchestrator.md`
**Agent index:** `.claude/agents/AGENTS_INDEX.md`

**MANDATORY:** Always show agent banner at start of EVERY response.
