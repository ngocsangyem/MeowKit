# Scoring Weights and Agent Thresholds

## Scoring Weights

```toon
weights[9]{criterion,weight,description}:
  Task Content Match,+50-60,Task-based patterns override repo (Layer 0) - HIGHEST PRIORITY
  Explicit Mention,+60,User directly mentions technology
  Keyword Exact Match,+50,Direct keyword match to intent
  Project Context,+40,CWD/file structure/package files
  Semantic Match,+35,Contextual/implied match
  Task Complexity,+30,Inferred complexity level
  Conversation History,+25,Previous context/active agents
  File Patterns,+20,Recent files/naming conventions
  Project Priority Bonus,+25,Agent in project-config.yaml priority list
```

**Task Content Override Rule:** When task content score >=50 for a different domain than the repo, that domain's agent becomes PRIMARY or co-PRIMARY.

---

## Agent Thresholds

```toon
thresholds[4]{level,score,role}:
  Primary Agent,>=80,Leads the task
  Secondary Agent,50-79,Supporting role
  Optional Agent,30-49,May assist
  Not Activated,<30,Not selected
```

---

## QA Agent Conditional Activation

**tester is ALWAYS Secondary when:**
- Intent = Implementation (+30 pts as secondary)
- Intent = Bug Fix (+35 pts as secondary)
- New feature being created
- Code modification requested

**tester is Primary when:**
- Intent = Testing (keywords: test, coverage, QA)
- User explicitly asks for tests
- Coverage report requested

**tester is SKIPPED when:**
- Pure documentation task
- Pure design discussion (no code)
- Research/exploration only
