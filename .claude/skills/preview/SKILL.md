---
name: mk:preview
version: 1.0.0
description: |
  Use when generating visual artifacts — explanations, diagrams, slides,
  diff visualizations, or plan-display HTML. Triggers on "explain X visually",
  "diagram this", "show as slides", "render this plan", "diff against main".
  NOT for live media generation (see mk:multimodal), browser QA (see mk:qa),
  or plan critique (see mk:plan-ceo-review).
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
  - plan-display
when_to_use: Use when generating visual artifacts — markdown or self-contained HTML — for code, architecture, plans, or git diffs. Use --html --plan-review to RENDER a plan as HTML (display only, no critique). NOT for plan critique/scope review (mk:plan-ceo-review) or media generation (mk:multimodal).
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

Generates visual artifacts — markdown and self-contained HTML — for explaining code, drawing diagrams, building slide decks, visualizing diffs, and rendering plans for review.

No live server. No Python. Pure markdown + HTML + bash file operations. Output writes to `tasks/plans/{active-plan}/visuals/` when an active plan exists; otherwise falls back to `tasks/visuals/`.

## When to Use

- A reader needs to understand an unfamiliar code path, protocol, or architecture
- A diagram (flowchart, sequence, ER) would communicate the topology faster than prose
- Step-by-step content benefits from slides over a single long page
- A pre-PR diff review needs visual KPIs, file map, and change cards
- An active plan needs an HTML render for a meeting (display only, not critique)
- Stakeholders prefer a self-contained HTML page they can open in a browser without a server

## Default (No Arguments)

If invoked with no arguments, present available operations via `AskUserQuestion`. Header: "Preview Operation". Question: "What would you like to do?".

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
| `--html --plan-review` | HTML render of a plan for review meetings             |

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
- `/mk:preview --html --plan-review [plan-file]` — render a plan as HTML. Default = active plan from `session-state/active-plan`.

`--ascii` does not combine with `--html` (terminal-only by design).

## Argument Resolution

Priority order:

1. `--html` flag detected → set HTML output mode
2. Generation flag detected (`--explain`, `--diagram`, `--slides`, `--ascii`) → load `references/generation-modes.md`
3. HTML-only flags (`--diff`, `--plan-review`) → imply `--html`; load `references/analytical-modes.md`
4. Topic missing → ask user via `AskUserQuestion`
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

## Output Path Lifecycle

```
session-state/active-plan exists?
  yes → value is absolute path?
          yes → {value}/visuals/
          no  → tasks/plans/{value}/visuals/   (treated as slug)
  no  → tasks/visuals/
```

Detail and the bash detection snippet live in `references/generation-modes.md` → "Step 1 — Resolve output path". The fallback path is logged on stderr (`warn:`) so silent path mismatches surface immediately.

## Error Handling

| Error                                            | Action                                                        |
| ------------------------------------------------ | ------------------------------------------------------------- |
| Topic empty after sanitization                   | Ask user for an alphanumeric topic                            |
| Flag without topic                               | Ask user for the topic string                                 |
| File write failure                               | Report the error; suggest checking disk space and permissions |
| Output path already exists                       | Overwrite without prompting                                   |
| `--diff` outside a git repo                      | Explain: "No git repository detected"                         |
| `--diff` with PR number, no `gh`                 | Suggest installing `gh` from https://cli.github.com/          |
| `--plan-review` with no plan file or active plan | Ask user for the plan path                                    |
| `--html --ascii` combination                     | Reject; suggest `--html --diagram` instead                    |
| Active-plan path absolute but missing            | Log warning; fall back to `tasks/visuals/`                    |
| Active-plan slug with no matching dir            | Log warning; fall back to `tasks/visuals/`                    |

## Reference Loading

Every mode reads its references BEFORE writing the output file.

| Mode                   | Always reads                                                                                                                   | Mode-specific                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `--explain`            | `references/generation-modes.md`, `references/mermaid-essentials.md`                                                           | —                                                             |
| `--diagram`            | `references/generation-modes.md`, `references/mermaid-essentials.md`                                                           | —                                                             |
| `--slides`             | `references/generation-modes.md`, `references/mermaid-essentials.md`                                                           | —                                                             |
| `--ascii`              | `references/generation-modes.md`                                                                                               | —                                                             |
| `--html --explain`     | `references/html-design-rules.md`, `mk:frontend-design/references/anti-slop-directives.md`                                     | template `assets/architecture.html`                           |
| `--html --diagram`     | `references/html-design-rules.md`, `references/mermaid-essentials.md`, `mk:frontend-design/references/anti-slop-directives.md` | template `assets/mermaid-flowchart.html`                      |
| `--html --slides`      | `references/html-design-rules.md`, `mk:frontend-design/references/anti-slop-directives.md`                                     | template `assets/slide-deck.html`                             |
| `--html --diff`        | `references/html-design-rules.md`, `references/analytical-modes.md`, `mk:frontend-design/references/anti-slop-directives.md`   | template `assets/data-table.html`, `assets/architecture.html` |
| `--html --plan-review` | `references/html-design-rules.md`, `references/analytical-modes.md`, `mk:frontend-design/references/anti-slop-directives.md`   | template `assets/data-table.html`, `assets/architecture.html` |

Templates in `assets/` are out-of-band — they are not auto-Read; the agent reads the template only when generating the matching mode.

## Composes With

- `mk:ui-design-system` — palette and typography selection (`assets/colors.csv` 160 rows, `assets/typography.csv` 73 rows). HTML modes vary palette per run.
- `mk:frontend-design` — anti-slop forbidden patterns. Cited via `references/anti-slop-directives.md`, not duplicated.
- `mk:web-to-markdown` — for users who want to view a generated markdown file in a browser, no server bundled here.
- `mk:scout` — for finding the right files to render in `--html --plan-review`.

## Gotchas

- **Mermaid `.node` class collision** — Mermaid.js uses `.node` internally. Page-level `.node` CSS leaks into diagrams. Use `.ve-card` or any non-`.node` class on cards.
- **Mandatory theme toggle** — every HTML artifact MUST include the light/dark toggle button as the first child of `<body>` per `references/html-design-rules.md`. Missing toggle = incomplete output.
- **Mermaid theme is static at load** — switching the page theme does not re-skin Mermaid SVG internals; the diagram color palette is read once at init. Document this; do not pretend otherwise.
- **Output path falls back silently** — when `session-state/active-plan` is missing or unreadable, output writes to `tasks/visuals/`. Log the fallback on stderr so users notice; do not raise.
- **Slug truncation at 80 chars** — topics get lowercased, hyphenated, stripped of non-alphanumerics, and truncated at word boundary. Title placeholder uses the original input in title case (not slug). Mismatch silently produces wrong filenames.
- **Topic strings are HTML-untrusted** — interpolating `--explain "</title><script>alert(1)</script>"` MUST render as literal text. HTML-entity-encode `< > & " '` in element and attribute contexts. See `references/html-design-rules.md` for context-by-context encoding rules.
- **Browser auto-open is conditional** — headless / SSH / WSL environments cannot open a browser. The shell snippet detects these cases and prints the path instead of invoking `open`/`xdg-open`.

## Workflow Position

- Phase: on-demand
- Follows: nothing required
- Precedes: nothing required
- Common pairings: invoked after a researcher report or planner output to communicate findings; invoked before a review meeting to render the active plan as HTML.

## Composes Into

- `mk:cook` may invoke `--explain` to communicate a complex implementation phase
- `mk:plan-ceo-review` consumes the same plan files; it CRITIQUES, this skill RENDERS — the boundary is intentional
