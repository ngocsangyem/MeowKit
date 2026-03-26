# After Detection

1. **Output detection result** with agent, model, and complexity
2. **Load agent instructions** from `agents/[agent-name].md`
3. **Use detected model** when spawning Task tool:
   ```
   Task(subagent_type="[agent]", model="[detected-model]", ...)
   ```
4. **Invoke appropriate skill:**
   - Complex feature -> `workflow-orchestrator`
   - Bug fix -> `bugfix-quick`
   - Test request -> `test-writer`
   - Code review -> `code-reviewer`
5. **Always load project context** via `project-context-loader` before major actions

---

## Available Agents

```toon
agents[4]{category,count,list}:
  Development,4,architect/frontend/mobile/gamedev
  Quality & Security,2,security/tester
  DevOps & Operations,1,devops
  Infrastructure,3,router/lead/scanner
```

---

## Manual Override

User can force specific agent:
```
User: "Use only tester for this task"
-> Override automatic selection
-> tester becomes PRIMARY regardless of scoring
```

---

**Full detection algorithm:** `agents/router.md`
**Selection guide:** `docs/AGENT_SELECTION_GUIDE.md`

**MANDATORY:** Always show agent banner at start of EVERY response.
