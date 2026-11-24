---
name: mk:preview
version: 1.0.0
description: "Renders code or a diff as diagram or deck. NOT for mk:tech-graph."
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
source: local
keywords:
  - preview
  - visual-explanation
  - diagram
  - mermaid
  - slides
  - html-output
  - ascii-diagram
  - diff-visualization
when_to_use: "Explain visually."
user-invocable: true
preamble-tier: 2
phase: on-demand
trust_level: kit-authored
injection_risk: low
owner: docs
criticality: medium
status: active
runtime: claude-code
---

# mk:preview

Generates visual artifacts — markdown and self-contained HTML — for explaining code, drawing diagrams, building slide decks, and visualizing diffs.

No live server. No Python. Pure markdown + HTML + bash file operations. Output writes to `tasks/visuals/`, or to `tasks/plans/{plan}/visuals/` when the user names a plan.

## When to Use

Not for publish-grade SVG diagrams (`mk:tech-graph`), inline Mermaid in docs (`mk:mermaidjs-v11`), or founder-mode plan critique (`mk:plan-ceo-review`).


- A reader needs to understand an unfamiliar code path, protocol, or architecture
- A diagram (flowchart, sequence, ER) would communicate the topology faster than prose
- Step-by-step content benefits from slides over a single long page
- A pre-PR diff review needs visual KPIs, file map, and change cards
- Stakeholders prefer a self-contained HTML page they can open in a browser without a server

## Default (No Arguments)

If invoked with no arguments, present available operations by asking the user. Header: "Preview Operation". Question: "What would you like to do?".

| Operation              | Description                                           |
| ---------------------- | ----------------------------------------------------- |
| `--explain`            | Markdown visual explanation (ASCII + Mermaid + prose) |
| `--diagram`            | Markdown diagram (ASCII + Mermaid)                    |
| `--slides`             | Markdown presentation slides                          |
| `--ascii`              | Terminal-friendly ASCII diagram only                  |
| `--html --explain`     | Self-contained HTML explanation, opens in browser     |
| `--html --diagram`     | HTML diagram with zoom/pan controls                   |
| `--html --slides`      | Magazine-quality HTML slide deck                      |
| `--html --diff`        | HTML diff visualization (KPI grid + file map + cards) |

Recommended default: `--explain` or `--html --explain`.

## Usage

### Markdown Generation

- `/mk:preview --explain <topic>` — visual explanation (ASCII + Mermaid + concepts)
- `/mk:preview --diagram <topic>` — focused diagram (ASCII + Mermaid)
- `/mk:preview --slides <topic>` — presentation slides (one concept per slide)
- `/mk:preview --ascii <topic>` — ASCII-only diagram (terminal-friendly)

### HTML Generation

- `/mk:preview --html --explain <topic>` — self-contained HTML explanation
- `/mk:preview --html --diagram <topic>` — HTML diagram with zoom/pan
- `/mk:preview --html --slides <topic>` — magazine-quality slide deck

### Analytical Modes

- `/mk:preview --html --diff [ref]` — visualize a git diff. Default `ref` = `main`. Accepts branch, commit, range, PR number.

`--ascii` does not combine with `--html` (terminal-only by design).

## Argument Resolution

Priority order:

1. `--html` flag detected → set HTML output mode
2. Generation flag detected (`--explain`, `--diagram`, `--slides`, `--ascii`) → load `references/generation-modes.md`
3. HTML-only flag (`--diff`) → implies `--html`; load `references/analytical-modes.md`
4. Topic missing → ask the user
5. Topic present → continue

**Topic-to-slug:**

- Lowercase the topic
- Replace spaces and special chars with hyphens
- Remove non-alphanumeric except hyphens
- Collapse multiple hyphens to single
- Trim leading/trailing hyphens
- Truncate at 80 chars on a word boundary

**Title placeholder `{topic}`** uses the original input in title case, not the slug.

**Multiple flags:** if more than one generation flag is supplied, use the first; the rest become part of the topic string.

## Output Path

Write to `tasks/visuals/` by default. When the user names a plan (a directory under `tasks/plans/`), write to `tasks/plans/{plan}/visuals/` instead. Create the directory first. Detail is in `references/generation-modes.md` → "Step 1 — Resolve output path".

## Error Handling

| Error                                            | Action                                                        |
| ------------------------------------------------ | ------------------------------------------------------------- |
| Topic empty after sanitization                   | Ask user for an alphanumeric topic                            |
| Flag without topic                               | Ask user for the topic string                                 |
| File write failure                               | Report the error; suggest checking disk space and permissions |
| Output path already exists                       | Overwrite without prompting                                   |
| `--diff` outside a git repo                      | Explain: "No git repository detected"                         |
| `--diff` with PR number, no `gh`                 | Suggest installing `gh` from https://cli.github.com/          |
| `--html --ascii` combination                     | Reject; suggest `--html --diagram` instead                    |
| Named plan directory does not exist              | Say so and write to `tasks/visuals/`                          |

## Reference Loading

Every mode reads its references BEFORE writing the output file.

| Mode                   | Always reads                                                                                                                   | Mode-specific                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `--explain`            | `references/generation-modes.md`, `references/mermaid-essentials.md`                                                           | —                                                             |
| `--diagram`            | `references/generation-modes.md`, `references/mermaid-essentials.md`                                                           | —                                                             |
| `--slides`             | `references/generation-modes.md`, `references/mermaid-essentials.md`                                                           | —                                                             |
| `--ascii`              | `references/generation-modes.md`                                                                                               | —                                                             |
| `--html --explain`     | `references/html-design-rules.md`, `../frontend-design/references/anti-slop-directives.md`                                     | template `assets/architecture.html`                           |
| `--html --diagram`     | `references/html-design-rules.md`, `references/mermaid-essentials.md`, `../frontend-design/references/anti-slop-directives.md` | template `assets/mermaid-flowchart.html`                      |
| `--html --slides`      | `references/html-design-rules.md`, `../frontend-design/references/anti-slop-directives.md`                                     | template `assets/slide-deck.html`                             |
| `--html --diff`        | `references/html-design-rules.md`, `references/analytical-modes.md`, `../frontend-design/references/anti-slop-directives.md`   | template `assets/data-table.html`, `assets/architecture.html` |

Templates in `assets/` are out-of-band — they are not auto-Read; the agent reads the template only when generating the matching mode.

## Composes With

- `mk:ui-design-system` — palette and typography selection. HTML modes vary palette per run.
- `mk:frontend-design` — anti-slop forbidden patterns. Cited via `../frontend-design/references/anti-slop-directives.md`, not duplicated.
- `mk:mermaidjs-v11` — Mermaid syntax and version rules for the diagrams emitted here.
- `mk:markdown-reader` — for users who want to read a generated markdown file in a browser.

## Gotchas

- **Mermaid `.node` class collision** — Mermaid.js uses `.node` internally. Page-level `.node` CSS leaks into diagrams. Use `.ve-card` or any non-`.node` class on cards.
- **Theme toggle** — include the light/dark toggle (the `assets/` templates have one) as the first child of `<body>`.
- **Mermaid theme is static at load** — switching the page theme does not re-skin Mermaid SVG internals; the diagram color palette is read once at init. Document this; do not pretend otherwise.
- **Plan-scoped output is opt-in** — nothing reads an active-plan record here; name the plan or the file lands in `tasks/visuals/`.
- **Slug truncation at 80 chars** — topics get lowercased, hyphenated, stripped of non-alphanumerics, and truncated at word boundary. Title placeholder uses the original input in title case (not slug). Mismatch silently produces wrong filenames.
- **Topic strings are HTML-untrusted** — interpolating `--explain "</title><script>alert(1)</script>"` must render as literal text. HTML-entity-encode `< > & " '` in element and attribute contexts. See `references/html-design-rules.md` for context-by-context encoding rules.
- **Browser auto-open is conditional** — headless / SSH / WSL environments cannot open a browser. The shell snippet detects these cases and prints the path instead of invoking `open`/`xdg-open`.
