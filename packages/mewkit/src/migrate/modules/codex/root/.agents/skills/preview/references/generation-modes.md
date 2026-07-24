# Generation Modes (markdown)

How `--explain`, `--diagram`, `--slides`, `--ascii` produce a `.md` artifact in the visuals directory. No live server is involved.

## Contents

- Step 1 — Resolve output path (with active-plan format detection)
- Step 2 — Generate per template
  - --explain
  - --diagram
  - --slides
  - --ascii
- Step 3 — Write file and report
- Notes on Mermaid emission

Before emitting any code-fenced mermaid block, Read `references/mermaid-essentials.md`.

## Step 1 — Resolve output path

CWD is the project root. Existing hooks (`pre-completion-check.sh:51`) read from `session-state/active-plan` — match that convention. The stored value can be either an absolute path (`orientation-ritual.cjs:18` declares values "canonically absolute") or a slug (`HOOKS_INDEX.md:77` documents the value as "slug"). The two docs disagree; treat the value as opaque and detect format at read time.

```bash
ACTIVE_PLAN_FILE="session-state/active-plan"

if [ -f "$ACTIVE_PLAN_FILE" ]; then
  RAW=$(tr -d '[:space:]' < "$ACTIVE_PLAN_FILE")
  case "$RAW" in
    /*)
      if [ -d "$RAW" ]; then
        OUTPUT_DIR="${RAW}/visuals"
      else
        echo "warn: active-plan='$RAW' is absolute but does not exist; falling back" >&2
        OUTPUT_DIR="tasks/visuals"
      fi
      ;;
    "")
      OUTPUT_DIR="tasks/visuals"
      ;;
    *)
      if [ -d "tasks/plans/$RAW" ]; then
        OUTPUT_DIR="tasks/plans/$RAW/visuals"
      else
        echo "warn: active-plan slug='$RAW' has no matching dir; falling back" >&2
        OUTPUT_DIR="tasks/visuals"
      fi
      ;;
  esac
else
  OUTPUT_DIR="tasks/visuals"
fi

mkdir -p "$OUTPUT_DIR"
```

**Rules:**

- Plan-scoped path = `tasks/plans/{slug}/visuals/`
- Flat fallback = `tasks/visuals/`
- Format detection guards against both documented formats; falls back loudly via stderr `warn:`
- Topic-to-slug rules live in SKILL.md → "Argument Resolution"

## Step 2 — Generate per template

Templates are flexible. Headings shown are the contract for grep-checkable smoke tests. Internal content is medium-freedom — agent picks the diagrams, examples, and emphasis that fit the topic.

### --explain

Output filename: `{topic-slug}.md`

```markdown
# Visual Explanation: {Topic}

## Quick View

[ASCII box diagram of the components, drawn with box-drawing characters: ┌─┐ │ │ └─┘]

## Detailed Flow

[Mermaid sequenceDiagram or flowchart — read references/mermaid-essentials.md first]

## Key Concepts

1. **Concept A** — short.
2. **Concept B** — short.
3. **Concept C** — short.

## Code Example

[Optional. Include only if a snippet clarifies more than prose. Use a code fence with language tag.]
```

### --diagram

Output filename: `{topic-slug}.md`

```markdown
# Diagram: {Topic}

## ASCII

[ASCII version drawn with box-drawing chars]

## Mermaid

[Mermaid version — flowchart TD or graph LR depending on topology]
```

### --slides

Output filename: `{topic-slug}.md`

One concept per slide. Separators are `---` lines. Default 8 slides; topic complexity may extend. Aim for hero / context / problem / solution / details / risks / next-steps / summary.

```markdown
# {Topic}

---

## Slide 1: Intro

- One bullet per concept
- Three to five bullets max

---

## Slide 2: Context

[Mermaid diagram or short prose]

---

## Slide 3: Problem

- Bullets

---

## Slide N: Summary

- Key takeaway 1
- Key takeaway 2
```

### --ascii

Output filename: `{topic-slug}.md`. NO Mermaid. Stdout AND file write. Use box-drawing characters for structure; include a legend at the bottom.

```
{Topic}

┌──────────────┐         ┌──────────────┐
│   Service A  │  ─────▶ │   Service B  │
└──────┬───────┘         └──────┬───────┘
       │                        │
       ▼                        ▼
┌──────────────┐         ┌──────────────┐
│   Cache      │ ◀ · · · │   Database   │
└──────────────┘         └──────────────┘

Legend:
  ─── data flow
  · · · optional path
  ▶    direction
```

## Step 3 — Write file and report

1. Compute the topic slug per SKILL.md rules.
2. Compute `OUTPUT_DIR` per Step 1.
3. Compute `OUTPUT_PATH = $OUTPUT_DIR/{slug}.md`.
4. Write the generated content to `OUTPUT_PATH`. Overwrite without prompting.
5. Report:
   - Absolute path of the generated file
   - One-line note on which directory was chosen (plan-scoped vs flat fallback)
   - Suggested follow-up: open in editor, or `mk:web-to-markdown` to render in a browser

For `--ascii`: also print the ASCII diagram to stdout so the user sees it inline.

## Notes on Mermaid emission

- Read `references/mermaid-essentials.md` BEFORE writing any mermaid block. Do not skip.
- The `.node` class trap: page-level `.node` CSS leaks into Mermaid SVG. Use `.ve-card` for cards in any HTML mode that follows.
- Layout direction: TD for hierarchies, LR for pipelines. ELK layout for 10+ nodes.
- No screenshot / render verification loop — agents lack reliable image-render tools. Emit syntax-valid Mermaid and stop.

## Risk reminders

- Slug truncation at 80 chars: long topics produce truncated filenames. Inform the user when truncated.
- `--ascii` is a fallback for terminal-only contexts, not a default. Prefer `--explain` or `--html --explain` for richer output.
- For `--slides` exceeding 8 slides, ask: does the topic justify the length, or is content overflowing what one deck should hold?
