# MeowKit Rules Index

Rules are loaded by the agent at session start.
All rules are mandatory unless marked [CONTEXTUAL].

| Rule | Purpose | Source | Applies to |
|------|---------|--------|-----------|
| `security-rules.md` | Block hardcoded secrets, any types, SQL injection, XSS patterns | MeowKit original | All modes, all phases |
| `injection-rules.md` | Prompt injection defense: DATA vs INSTRUCTIONS boundary | MeowKit original | All modes, all phases |
| `gate-rules.md` | Gate 1 (plan approval) and Gate 2 (review approval) hard stops | MeowKit original | Phases 1, 4 |
| `tdd-rules.md` | TDD enforcement: failing test before implementation | MeowKit original | Phases 2, 3 |
| `naming-rules.md` | Naming conventions per platform (TS, Vue, Swift, DB) | MeowKit original | Implementation, review |
| `development-rules.md` | File management, code quality, pre-commit, git safety, docs impact | Adapted from claudekit-engineer | Implementation, commit |
| `orchestration-rules.md` | Subagent delegation, file ownership, parallel vs sequential | Adapted from claudekit-engineer | Multi-agent workflows [CONTEXTUAL] |
| `context-ordering-rules.md` | Long content first, context before constraint, self-contained docs | New (prompting best practices) | Plans, prompts, handoffs |
| `model-selection-rules.md` | Task type → model tier routing, security escalation | New (prompting best practices) | Phase 0 (Orient) |
| `output-format-rules.md` | Response structure: what changed, why, file refs, open questions | New (prompting best practices) | All agent responses |
| `search-before-building-rules.md` | 3-layer knowledge framework: search before implementing unfamiliar patterns | Adapted from gstack ETHOS.md | Implementation, planning |
| `scale-adaptive-rules.md` | Domain-based complexity routing, CSV match override, Gate 1 one-shot bypass | New (BMAD-inspired) | Phase 0 (Orient) |

## Loading Priority

Rules are applied in this priority (higher = stronger override):

1. `security-rules.md` — NEVER override
2. `injection-rules.md` — NEVER override
3. `gate-rules.md` — NEVER override (except /fix simple bypasses Gate 1)
4. `tdd-rules.md` — override only in [fast] mode
5. `naming-rules.md` — always apply
6. `development-rules.md` — always apply
7. `context-ordering-rules.md` — always apply
8. `model-selection-rules.md` — always apply
9. `output-format-rules.md` — always apply
10. `scale-adaptive-rules.md` — always apply at Phase 0
11. `orchestration-rules.md` — apply only in multi-agent workflows [CONTEXTUAL]

## Rule Format Convention

Every rule file follows this structure:
- **Frontmatter**: source, original_file, adapted, adaptation_notes
- **Imperative language**: ALWAYS, NEVER, MUST (not "consider", "try to")
- **WHY explanations**: every rule includes its rationale
- **INSTEAD alternatives**: every NEVER is paired with what TO DO instead
- **Measurable checks**: rules can be verified mechanically, not subjectively
