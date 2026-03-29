# Agent Selector — Party Mode

Select the most relevant 2-4 agents for the given discussion topic.

## Selection Rules

1. Scan topic for domain keywords (see table in SKILL.md)
2. Select matching agent set (2-4 agents)
3. If user provided `--agents` flag, use their selection instead
4. If no keywords match, default to: planner + architect + developer
5. Never select more than 4 agents
6. Never include the same agent twice

## Agent Capabilities Reference

| Agent | Expertise | When to Include |
|-------|-----------|-----------------|
| planner | Scope, requirements, trade-offs, roadmap | Almost always — grounds discussion in goals |
| architect | System design, patterns, scalability, infra | Architecture decisions, tech stack choices |
| developer | Implementation feasibility, code patterns, DX | Technical trade-offs, refactoring |
| security | Auth, encryption, vulnerabilities, compliance | Any security-adjacent topic |
| tester | Test strategy, coverage, quality gates | Testing approach decisions |
| reviewer | Code quality, maintainability, standards | Quality trade-offs, review process |
| analyst | Cost, patterns, metrics | Budget decisions, performance targets |
| ui-ux-designer | UI/UX, accessibility, responsive design | Frontend and design decisions |

## Output

Return the agent list as: `Selected agents: [agent1, agent2, agent3]`
Then proceed to Round 1.
