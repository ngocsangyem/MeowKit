# Multi-Layer Detection Reference

Beyond the CSV match, three more layers add evidence. Layer 3 turns it into a confidence.

## Contents

- [Layer 0 — CSV Keyword Match](#layer-0-csv-keyword-match)
- [Layer 1 — Task Content Analysis](#layer-1-task-content-analysis)
- [Layer 2 — Project Context Analysis](#layer-2-project-context-analysis)
- [Layer 3 — Confidence](#layer-3-confidence)
- [Anti-Pattern: Repo Type ≠ Task Domain](#anti-pattern-repo-type-task-domain)


---

## Layer 0 — CSV Keyword Match

Match task description keywords against `data/domain-complexity.csv`.

- Matching is case-insensitive
- First domain match wins for domain name
- Multiple domain matches → use HIGHEST complexity level
- No match → return `unknown`, fall back to manual classification

This layer runs first. Layers 1–3 add evidence; they do not replace it.

---

## Layer 1 — Task Content Analysis

Analyze the actual task description beyond CSV keyword matching.

**Classify the task type:**

| Indicator                                                                               | Task Type |
| --------------------------------------------------------------------------------------- | --------- |
| "bug", "error", "broken", "regression", "fails", "issue", "failure", steps-to-reproduce | bug_fix   |
| "add", "implement", "build", "create", "new feature"                                    | feature   |
| "refactor", "clean up", "extract", "simplify", "rename"                                 | refactor  |
| "vulnerability", "CVE", "audit", "penetration", "secrets"                               | security  |
| "deploy", "CI/CD", "pipeline", "docker", "kubernetes"                                   | devops    |
| "docs", "README", "changelog", "API docs"                                               | docs      |
| "review", "PR", "pull request", "check"                                                 | review    |
| "PRD", "ticket", "triage", "analyze ticket"                                             | intake    |

**Extract mentioned files and modules:**

- Files named → detect domain from path (e.g., `src/auth/` → auth domain)
- Module names → cross-reference against known domain keywords

---

## Layer 2 — Project Context Analysis

Check the actual project environment for domain signals.

**Project structure signals:**

| File present                   | Inferred technology     |
| ------------------------------ | ----------------------- |
| `package.json`                 | JavaScript / TypeScript |
| `pyproject.toml` or `setup.py` | Python                  |
| `go.mod`                       | Go                      |
| `Cargo.toml`                   | Rust                    |

**Directory existence signals:**

| Directory                         | Domain signal         |
| --------------------------------- | --------------------- |
| `src/auth/` or `lib/auth/`        | authentication domain |
| `src/billing/` or `src/payments/` | fintech domain        |
| `src/api/`                        | API domain            |
| `src/admin/`                      | internal_tools domain |

**Recent git changes:**

- Run `git diff --name-only HEAD~5` to identify recently changed files
- Map changed directories to domain signals

---

## Layer 3 — Confidence

Weigh the evidence: a CSV match, the task naming the domain, related files or directories
present, and recent git changes in the area. All four agree: HIGH, use the domain routing.
A CSV match plus one more: MEDIUM, use it and note the uncertainty. A CSV match alone or
less: LOW, fall back to manual classification.

---

## Anti-Pattern: Repo Type ≠ Task Domain

Do not classify a task on repository type alone. A frontend task (for example, "fix the login
button styles") in a backend-heavy repository routes to frontend patterns, because the task
content determines routing, not the repository's dominant language. Task content (Layer 1)
outranks project structure (Layer 2) when they conflict.
