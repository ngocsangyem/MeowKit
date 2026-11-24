# Audit and apply

Read each doc fully before editing it, and compare it with the diff. These heuristics fit any repo.

List the docs: `find . -maxdepth 2 -name "*.md" -not -path "./.git/*" -not -path "./node_modules/*" -not -path "./.meowkit/memory/*" | sort`. Classify the change: new features, changed behaviour, removed functionality, infrastructure.

| Doc | Check |
| --- | --- |
| README | Describes every feature the diff adds; install and setup match; examples and troubleshooting still hold |
| Architecture | Diagrams and component descriptions match the code. Be conservative: update only what the diff clearly contradicts |
| Contributing | Walk the setup as a new contributor would: do the commands exist and work, do test descriptions match the test setup |
| Project instructions (`CLAUDE.md`, `AGENTS.md`) | The structure section matches the file tree; commands and scripts exist in `package.json` or its equivalent |
| Other `.md` | Work out its purpose and audience, then look for statements the diff contradicts |

## Auto or ask

- **Auto-update**: factual corrections the diff clearly warrants: add an item to a table, fix a path or a count, update a structure tree. Report each as what changed ("README.md: added /new-skill to the skills table, count 9 to 10"), never just "updated README.md".
- **Ask first**: README introduction or positioning, architecture philosophy or rationale, security-model descriptions, removing a section, a rewrite over about 10 lines in one section, a brand-new section, anything of unclear relevance.

For each question give the file, the specific decision, a recommendation with a one-line reason, and a "skip, leave as is" option. Apply an approved change right away. Use exact-match edits (the host's Edit tool or an equivalent) rather than rewriting a whole file, so unrelated text survives.

## Consistency pass

Contradictions between docs: fix the factual ones (a version mismatch, a stale count) and ask about narrative ones. A doc nothing links to is a discoverability gap; link it from README or the project instructions after asking.
