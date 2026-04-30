# Detection Examples


## Contents

- [Example 1: Explicit Technology Mention](#example-1-explicit-technology-mention)
- [Example 2: Context-Based Detection (No Tech Mention)](#example-2-context-based-detection-no-tech-mention)
- [Example 3: Architecture Task (Uses Opus)](#example-3-architecture-task-uses-opus)
- [Example 4: Quick Fix (Uses Haiku)](#example-4-quick-fix-uses-haiku)
- [Example 5: Backend Repo, Frontend Task (Task-Based Override)](#example-5-backend-repo-frontend-task-task-based-override)
- [Example 6: Frontend Repo, Database Task (Task-Based Override)](#example-6-frontend-repo-database-task-task-based-override)
- [Example 7: Backend Repo, PDF Generation (Task-Based Override)](#example-7-backend-repo-pdf-generation-task-based-override)

## Example 1: Explicit Technology Mention

```
User: "Create a React Native screen for user profile"

Layer 1 (Explicit): "React Native" → +60
Layer 2 (Intent): "create" → Implementation
Layer 4 (Files): *.phone.tsx present → +20

Detection Result:
  Agent: developer (PRIMARY, 80 pts)
  Model: sonnet
  Complexity: Standard
  Secondary: tester (30)
```

## Example 2: Context-Based Detection (No Tech Mention)

```
User: "Fix the login bug"

Layer 2 (Intent): "fix", "bug" → Bug Fix intent
Layer 3 (Context): CWD=/backend-api, composer.json has laravel → +40
Layer 4 (Files): AuthController.php recent → +20

Detection Result:
  Agent: developer (PRIMARY, 95 pts)
  Model: sonnet
  Complexity: Standard
  Skill: mk:fix
  Secondary: tester (35)
```

## Example 3: Architecture Task (Uses Opus)

```
User: "Design the authentication system architecture"

Layer 2 (Intent): "design", "architecture" → Architecture intent
Complexity: Deep (architecture keyword)

Detection Result:
  Agent: architect (PRIMARY)
  Model: opus (architecture task)
  Complexity: Deep
  Secondary: security (55)
```

## Example 4: Quick Fix (Uses Haiku)

```
User: "Fix typo in README.md line 42"

Complexity: Quick (single file, explicit location)

Detection Result:
  Agent: orchestrator (handles directly — too simple for delegation)
  Model: haiku
  Complexity: Quick
```

## Example 5: Backend Repo, Frontend Task (Task-Based Override)

```
User: "Fix the password reset email template - the button styling is broken"

Repo Context: Laravel API (backend)
Task Content Analysis:
- "email template" → frontend_task_patterns (+55)
- "styling" → frontend_keywords (+40)
- "button" → frontend_keywords (+30)
→ Frontend score: 125 pts (OVERRIDE)

Detection Result:
  Agent: developer (PRIMARY, 125 pts) — leads template fix
  Model: sonnet
  Complexity: Standard
```

## Example 6: Frontend Repo, Database Task (Task-Based Override)

```
User: "The user list page is slow - optimize the query"

Repo Context: Next.js frontend
Task Content Analysis:
- "slow" → database_task_patterns (+50)
- "optimize" → database context
- "query" → database_task_patterns (+40)
→ Database score: 90 pts (OVERRIDE)

Detection Result:
  Agent: developer (PRIMARY, 90 pts) — database optimization
  Model: sonnet
  Complexity: Standard
```

## Example 7: Backend Repo, PDF Generation (Task-Based Override)

```
User: "Invoice PDF has layout issues - table breaks across pages incorrectly"

Repo Context: Node.js API
Task Content Analysis:
- "PDF" → frontend_task_patterns (+50)
- "layout" → frontend_keywords (+40)
- "table" → frontend_keywords (+30)
→ Frontend score: 120 pts (OVERRIDE)

Detection Result:
  Agent: developer (PRIMARY, 120 pts) — HTML/CSS for PDF
  Model: sonnet
  Complexity: Standard
```