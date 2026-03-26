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
5. **Context loaded automatically** via MeowKit's Phase 0 (Orient) — memory/lessons.md + memory/patterns.json

---

## Available Agents

MeowKit agents at `.claude/agents/`:

```toon
agents[5]{category,count,list}:
  Planning,3,orchestrator/planner/architect
  Development,1,developer
  Quality & Security,3,tester/reviewer/security
  Operations,2,shipper/documenter
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
