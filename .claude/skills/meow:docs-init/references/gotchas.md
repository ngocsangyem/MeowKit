# Gotchas

Update when docs-init fails in new scenarios.

- **Hallucinating architecture**: generating docs about code that doesn't exist → always scout FIRST with meow:scout; generate only from confirmed findings, never from assumptions
- **Over-documenting small projects**: creating 7 doc files for a 50-line script → check project size first; small projects (<10 files) get README + codebase-summary only
- **Stale on first run**: docs describe initial state but drift after first feature → tell user to run meow:document-release after each ship cycle
- **Duplicating README content**: project-overview.md repeats what README says → README = external audience (setup, usage); project-overview.md = internal audience (why it exists, design decisions)
- **Missing entry points**: codebase-summary.md doesn't identify main.ts/index.ts → scout must find entry points explicitly; list them in codebase-summary under "Entry Points"
- **Generating deployment docs for non-deployed projects**: creating deployment-guide.md for a library with no CI/CD → only generate optional docs when relevant config files are detected (Dockerfile, .github/workflows/, etc.)
