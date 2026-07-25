# llms.txt Specification (from llmstxt.org)

## Required Elements

| Element | Rule |
|---------|------|
| H1 | Required. Project or site name. |
| Blockquote | Recommended. Brief essential context about the project. |
| Sections | H2-delimited groups of related links. |
| Links | Format: `[Title](url): Optional description` |
| `## Optional` | Special section — content here can be skipped for short context windows. |
| Language | Concise, clear, no unexplained jargon. |

## Format Rules

- One H1 at the top (project name)
- One blockquote immediately after H1 (project summary)
- Multiple H2 sections grouping related documentation
- Each entry is a markdown link with optional colon-separated description
- `## Optional` section at the end for supplementary content
- No HTML, no images, no embedded code — pure markdown text

## Categorization Guidelines

| Category | Content type |
|----------|-------------|
| Getting Started | Installation, quickstart, setup guides |
| API Reference | Endpoint docs, function signatures, type definitions |
| Guides | How-to guides, tutorials, walkthroughs |
| Architecture | System design, ADRs, infrastructure docs |
| Configuration | Config options, environment variables, settings |
| Optional | FAQ, changelog, contributing guide, migration notes |

## Quality Checklist

1. H1 heading present (required)
2. Blockquote summary present (recommended)
3. All links use valid markdown: `[title](url)`
4. Descriptions are one sentence each
5. Optional section is last
6. No broken or empty links
7. No duplicate entries
