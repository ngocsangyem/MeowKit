# Agent Selection for Party Mode

Select 2-4 agents based on the discussion topic.

## Selection Rules

| Topic Domain | Recommended Agents |
|-------------|-------------------|
| Architecture decisions | architect, developer, security |
| Technology choices | researcher, developer, architect |
| Feature prioritization | planner, developer, tester |
| Performance tradeoffs | developer, architect, reviewer |
| Security concerns | security, architect, developer |
| UX/design decisions | ui-ux-designer, developer, planner |
| Testing strategy | tester, developer, reviewer |

## Constraints

- Minimum 2 agents, maximum 4
- Always include one agent who will IMPLEMENT the decision (usually developer)
- Always include one agent who will CHALLENGE the decision (reviewer, security, or architect)
- Never include orchestrator or analyst — they manage, not debate
