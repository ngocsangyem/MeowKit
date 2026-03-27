# Skill Filesystem Patterns

## When to use each subfolder

```
scripts/      Executable scripts for deterministic checks
              Use when: skill needs to run validation outside the LLM
              Examples: security-scan.py, check-types.sh, validate-schema.py

references/   Detailed docs loaded on-demand
              Use when: SKILL.md would exceed 150 lines with inline content
              Examples: api-reference.md, error-codes.md, platform-specifics.md

assets/       Templates and boilerplate to copy
              Use when: skill generates files from templates
              Examples: output-template.md, config-template.json

lib/          Reusable code for Claude to compose
              Use when: skill has shared logic across multiple operations
              Examples: utils.py, helpers.ts

config.json   User-specific setup
              Use when: skill needs project-specific values (API keys, paths, preferences)
              Pattern: check on first use → ask user → save for future sessions
```

## Size guideline

- SKILL.md: under 150 lines (router + gotchas + key decisions)
- Each reference file: under 200 lines
- Scripts: as short as possible; one purpose per script
