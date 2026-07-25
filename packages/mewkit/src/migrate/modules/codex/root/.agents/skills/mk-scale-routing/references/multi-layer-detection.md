# Multi-Layer Detection Reference

Scale-routing v2.0 extends single-layer CSV matching with 3 additional layers.
Each layer adds evidence. Layer 3 synthesizes all evidence into a confidence score.

## Contents

- [Layer 0 — CSV Keyword Match (EXISTING)](#layer-0-csv-keyword-match-existing)
- [Layer 1 — Task Content Analysis (NEW)](#layer-1-task-content-analysis-new)
- [Layer 2 — Project Context Analysis (NEW)](#layer-2-project-context-analysis-new)
- [Layer 3 — Confidence Scoring (NEW)](#layer-3-confidence-scoring-new)
- [Anti-Pattern: Repo Type ≠ Task Domain](#anti-pattern-repo-type-task-domain)


---

## Layer 0 — CSV Keyword Match (EXISTING)

Existing behavior — unchanged. Match task description keywords against `data/domain-complexity.csv`.

- Matching is case-insensitive
- First domain match wins for domain name
- Multiple domain matches → use HIGHEST complexity level
- No match → return `unknown`, fall back to manual classification

**This layer is always run first. Layers 1–3 extend it — they do not replace it.**

---

## Layer 1 — Task Content Analysis (NEW)

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

## Layer 2 — Project Context Analysis (NEW)

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

## Layer 3 — Confidence Scoring (NEW)

Score each detected domain from 0–100 using weighted evidence.

| Evidence                              | Points |
| ------------------------------------- | ------ |
| CSV keyword match                     | +40    |
| Task content mentions domain          | +30    |
| Project has related files/directories | +20    |
| Recent git changes in domain area     | +10    |

**Confidence thresholds:**

| Score | Confidence | Action                                 |
| ----- | ---------- | -------------------------------------- |
| ≥ 70  | HIGH       | Use domain routing — strong signal     |
| 40–69 | MEDIUM     | Use domain routing with note in output |
| < 40  | LOW        | Fall back to manual classification     |

---

## Anti-Pattern: Repo Type ≠ Task Domain

**NEVER** classify a task based on repository type alone.

A frontend task (e.g., "fix the login button styles") in a backend-heavy repository
should route to **frontend** patterns — not backend — because the task content
determines routing, not the repository's dominant language or structure.

Evidence from task content (Layer 1) takes precedence over project structure
signals (Layer 2) when they conflict.