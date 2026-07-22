# Context Hub (chub) CLI Patterns


## Contents

- [Usage](#usage)
- [Core Commands](#core-commands)
  - [Search for documentation](#search-for-documentation)
  - [Fetch documentation by ID](#fetch-documentation-by-id)
  - [Local annotations (persist across sessions)](#local-annotations-persist-across-sessions)
  - [Feedback to maintainers](#feedback-to-maintainers)
  - [Registry and cache management](#registry-and-cache-management)
- [Agent Piping Patterns](#agent-piping-patterns)
- [Flags Reference](#flags-reference)
- [When to Use chub Over Context7](#when-to-use-chub-over-context7)
- [Trust Policy](#trust-policy)
- [Content Model](#content-model)
- [Coverage (~1,000+ APIs as of March 2026)](#coverage-1000-apis-as-of-march-2026)

## Usage

Runs via `npx` — no global install required:

```bash
npx chub search "stripe"
npx chub get stripe/api --lang js
```

## Core Commands

### Search for documentation

```bash
npx chub search                          # List everything available
npx chub search "stripe"                 # Fuzzy search
npx chub search stripe/payments          # Exact ID → full detail
npx chub search "stripe" --json          # Structured JSON output (for agents)
npx chub search --tags docs,openai       # Filter by tags
```

### Fetch documentation by ID

```bash
npx chub get stripe/api                  # Print doc to terminal
npx chub get stripe/api --lang py        # Python-specific docs
npx chub get stripe/api --lang js        # JavaScript-specific docs
npx chub get stripe/api -o doc.md        # Save to file
npx chub get stripe/api --full           # Fetch all files, not just entry
npx chub get openai/chat stripe/api      # Fetch multiple at once
npx chub get pw-community/login-flows    # Fetch a skill
```

### Local annotations (persist across sessions)

```bash
npx chub annotate stripe/api "Webhook needs raw body"
npx chub annotate --list                 # See all saved notes
npx chub annotate stripe/api --clear     # Remove a note
```

### Feedback to maintainers

```bash
npx chub feedback stripe/api up          # Worked well
npx chub feedback stripe/api down --label outdated   # Needs updating
```

### Registry and cache management

```bash
npx chub update                          # Refresh the cached registry
npx chub cache status                    # Check cache state
npx chub cache clear                     # Clear local cache
```

## Agent Piping Patterns

```bash
# Get the top result ID
npx chub search "stripe" --json | jq -r '.results[0].id'

# Search → pick → fetch → save
ID=$(npx chub search "stripe" --json | jq -r '.results[0].id')
npx chub get "$ID" --lang js -o .context/stripe.md

# Fetch multiple at once
npx chub get openai/chat stripe/api -o .context/
```

## Flags Reference

| Flag | Purpose |
|------|---------|
| `--json` | Structured JSON output (for agents and piping) |
| `--tags <csv>` | Filter by tags (e.g. docs, skill, openai) |
| `--lang <lang>` | Language variant: py, js, ts, rb, cs |
| `--full` | Fetch all files, not just entry point |
| `-o, --output <path>` | Write content to file or directory |

## When to Use chub Over Context7

| Scenario | Use chub | Use Context7 |
|----------|----------|-------------|
| Need language-specific docs (py vs js) | yes | |
| Need curated, human-reviewed docs | yes | |
| Need annotations from past sessions | yes | |
| Want JSON output for piping | yes | |
| Broad library coverage | | yes |
| Zero setup required | | yes |
| Topic-scoped queries | | yes |

## Trust Policy

chub uses a configurable trust hierarchy:

1. **Official** — docs from the library's own team
2. **Maintainer** — docs from verified community maintainers
3. **Community** — docs from any contributor

Multi-source config at `~/.chub/config.yaml` supports local/internal registries.

## Content Model

chub docs follow "write for machines" principles:

- Markdown with YAML frontmatter
- Under 500 lines (covers 90% use case)
- Code-first examples
- List common mistakes
- Multi-language support

## Coverage (~1,000+ APIs as of March 2026)

Popular libs with good coverage:

- Stripe, OpenAI, Supabase, Firebase
- React, Vue, Angular, Svelte
- Express, Fastify, NestJS
- Django, Flask, FastAPI
- AWS SDK, GCP, Azure

Gaps: newer/niche libraries may not be indexed yet.