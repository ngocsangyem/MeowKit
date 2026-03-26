# Context Hub (chub) CLI Patterns

## Installation (Optional)

```bash
npm install -g @aisuite/chub
```

## Core Commands

### Search for documentation

```bash
npx chub search [query]
# Returns: list of matching doc IDs with names and versions
```

### Fetch documentation by ID

```bash
npx chub get <id>                    # Default language
npx chub get <id> --lang py          # Python-specific docs
npx chub get <id> --lang js          # JavaScript-specific docs
npx chub get <id> --version 2024-12-18  # Specific version
npx chub get <id> --file reference   # Fetch only the reference file
```

### Local annotations

```bash
npx chub annotate <id> "webhook needs raw body"
# Annotations persist at ~/.chub/annotations/
# Appended to docs on subsequent fetches
```

### Feedback to maintainers

```bash
npx chub feedback <id> down --label outdated
npx chub feedback <id> up
```

### Offline mode

```bash
npx chub update --full    # Download everything for offline use
```

## When to Use chub Over Context7

| Scenario                               | Use chub | Use Context7 |
| -------------------------------------- | -------- | ------------ |
| Need language-specific docs (py vs js) | ✓        |              |
| Need curated, human-reviewed docs      | ✓        |              |
| Working offline                        | ✓        |              |
| Need annotations from past sessions    | ✓        |              |
| Broad library coverage                 |          | ✓            |
| Zero setup required                    |          | ✓            |
| Topic-scoped queries                   |          | ✓            |

## Trust Policy

chub uses a configurable trust hierarchy:

1. **Official** — docs from the library's own team
2. **Maintainer** — docs from verified community maintainers
3. **Community** — docs from any contributor

Default: accept official + maintainer, warn on community-only.

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
