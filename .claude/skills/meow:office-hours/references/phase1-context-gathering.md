# Phase 1: Context Gathering

Understand the project and the area the user wants to change.

```bash
eval "$(.claude/scripts/bin/meowkit-slug 2>/dev/null)"
```

1. Read `CLAUDE.md`, `TODOS.md` (if they exist).
2. Run `git log --oneline -30` and `git diff origin/main --stat 2>/dev/null` to understand recent context.
3. Use Grep/Glob to map the codebase areas most relevant to the user's request.
4. **List existing design docs for this project:**
   ```bash
   ls -t .claude/memory/projects/*-design-*.md 2>/dev/null
   ```
   If design docs exist, list them: "Prior designs for this project: [titles + dates]"

5. **Ask: what's your goal with this?** This is a real question, not a formality. The answer determines everything about how the session runs.

   Via AskUserQuestion, ask:

   > Before we dig in — what's your goal with this?
   >
   > - **Building a startup** (or thinking about it)
   > - **Intrapreneurship** — internal project at a company, need to ship fast
   > - **Hackathon / demo** — time-boxed, need to impress
   > - **Open source / research** — building for a community or exploring an idea
   > - **Learning** — teaching yourself to code, vibe coding, leveling up
   > - **Having fun** — side project, creative outlet, just vibing

   **Mode mapping:**
   - Startup, intrapreneurship → **Startup mode** (Phase 2A)
   - Hackathon, open source, research, learning, having fun → **Builder mode** (Phase 2B)

6. **Assess product stage** (only for startup/intrapreneurship modes):
   - Pre-product (idea stage, no users yet)
   - Has users (people using it, not yet paying)
   - Has paying customers

Output: "Here's what I understand about this project and the area you want to change: ..."
