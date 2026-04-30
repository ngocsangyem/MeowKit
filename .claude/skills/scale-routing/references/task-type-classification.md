# Task Type Classification Reference

Scale-routing v2.0 classifies incoming work into 8 actionable task types.
This enables suggesting the right skill — not just the right model tier.

---

## Classification Table

| Task Type | Signal Keywords / Patterns | Suggested Skill | Notes |
|---|---|---|---|
| **Bug Fix** | "bug", "error", "broken", "fails", "regression", steps-to-reproduce present | `mk:fix` or `mk:investigate` | Use `mk:investigate` when root cause is unknown |
| **Feature** | "add", "implement", "build", "create", "new" | `mk:cook` | Default for greenfield work |
| **Refactor** | "refactor", "clean up", "extract", "simplify", "rename" | `mk:cook --fast` | Behavior unchanged — structure only |
| **Security** | "vulnerability", "CVE", "audit", "penetration", "secrets" | `mk:cso` | Forces COMPLEX tier — no downgrade |
| **DevOps** | "deploy", "CI/CD", "pipeline", "docker", "kubernetes" | `mk:cook` | Infrastructure as code follows standard flow |
| **Documentation** | "docs", "README", "changelog", "API docs" | `mk:docs-init` or `mk:document-release` | MICRO-TASK eligible — Gate 1 bypass possible |
| **Review** | "review", "PR", "pull request", "check" | `mk:review` | Adversarial 4-step review workflow |
| **Intake** | "PRD", "ticket", "issue", "analyze ticket", "triage" | `mk:intake` | Phase 2 — not yet available in v1.x |

---

## Classification Priority

When multiple task types match, use this priority order:

1. **Security** — always wins; forces COMPLEX tier regardless of other signals
2. **Bug Fix** — production issues take priority over planned work
3. **Intake** — if description is a raw ticket or PRD, classify before doing any work
4. **Feature / Refactor / DevOps / Docs / Review** — determined by dominant signal keywords

---

## Confidence Interaction

Task type classification feeds into Layer 3 confidence scoring:

- Task type matches a domain keyword from CSV → +10 points (reinforcing signal)
- Task type contradicts domain (e.g., task_type=docs but domain=fintech) → note in output, use domain level

---

## Output Fields

When task type is classified, scale-routing adds to its output:

```json
{
  "task_type": "bug_fix",
  "suggested_skill": "mk:fix",
  "confidence": "HIGH"
}
```

`suggested_skill` is a recommendation — the orchestrator may override based on task context.
`task_type` is always set; `suggested_skill` defaults to `mk:cook` when no specific match.

---

## Disambiguation Examples

| Task Description | task_type | suggested_skill | Reasoning |
|---|---|---|---|
| "Login button is broken on mobile" | bug_fix | mk:fix | "broken" + UI context |
| "Add OAuth2 support" | feature | mk:cook | "add" dominant signal |
| "Extract auth logic into service" | refactor | mk:cook --fast | "extract" + "service" |
| "Audit session token storage" | security | mk:cso | "audit" + "token" = security |
| "Update CHANGELOG for v2.1" | docs | mk:document-release | "changelog" = release docs |
| "Review PR #342" | review | mk:review | explicit "review PR" |
