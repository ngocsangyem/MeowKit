---
trigger: model_decision
description: Commit, push, pull-request and documentation-impact conventions. Use when about to commit, push, open a pull request or finish an implementation.
---

# Shipping conventions

The always-on block in `AGENTS.md` holds the short form. This file adds the details, and loads
only when the task is about shipping.

## Before a commit

- Lint with zero errors on the files you changed; run the project's tests when it has any.
- Stage no confidential file (`.env`, credentials, API keys).
- Use conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`) with a
  descriptive message, and commit often. Leave AI references out of the message.

## Before a push

- Pull first, so conflicts surface early.
- Push a feature branch and open a pull request; never push to `main` or `master` directly.
- Never force-push unless the user asks for it: it rewrites history others may hold.

## After an implementation

State the documentation impact: `none`, `minor` (update existing docs) or `major` (new
documentation needed). For `minor` or `major`, update the affected docs in the same pull
request as the code change.
