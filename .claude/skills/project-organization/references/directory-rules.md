# Directory Rules — Project Organization

## Directory Categories

Every project file belongs to one of these categories:

| Category | Path | Purpose |
|----------|------|---------|
| Source code | `src/` or project root | Application code |
| Documentation | `docs/` | Human + AI readable docs, guides, specs |
| Tasks | `tasks/` | Plans, reviews, templates |
| Tests | `tests/` or `__tests__/` | Test suites |
| Scripts | `scripts/` or `.claude/scripts/` | Build, deploy, utility scripts |
| Assets | `assets/{type}/` | Media, branding, designs |
| Config | Root or `.config/` | Dotfiles, config files |
| Kit     | `.claude/` | Agent toolkit (skills, agents, rules, hooks, memory) |

### Kit-Specific Paths

```
.claude/
├── agents/          Agent definitions
├── skills/          mk: prefixed skills
├── rules/           Enforcement rules
├── hooks/           Lifecycle hooks
├── memory/          Cross-session persistence
├── scripts/         Validation scripts
│   └── bin/         Shell utilities
└── settings.json    Hook registrations

tasks/
├── templates/       Plan templates
├── plans/           Active/completed plans
│   └── YYMMDD-name.md
└── reviews/         Review verdicts
    └── YYMMDD-name-verdict.md
```

## Naming Patterns

All filenames use **kebab-case**, self-documenting names.

| Mode | Pattern | Use when | Example |
|------|---------|----------|---------|
| Timestamped | `YYMMDD-{slug}` | Plans, reviews, reports | `260326-auth-plan.md` |
| Evergreen | `{slug}` | Stable docs, configs | `system-architecture.md` |
| Variant | `{slug}-{variant}.{ext}` | Multiple versions | `logo-dark.svg` |

**Slug rules:** lowercase, hyphens only, max 50 chars, self-documenting, no leading/trailing hyphens.

## Path Resolution Decision Tree

```
1. Source code? → src/ or project root
2. Test? → tests/ (mirror source structure)
3. Plan or review? → tasks/plans/ or tasks/reviews/
4. Documentation? → docs/
5. Kit config? → .claude/
6. Asset? → assets/{type}/
7. Script? → scripts/
8. Config? → root or .config/
```

## Nesting Logic

| Scenario | Pattern |
|----------|---------|
| Single file | Flat in category dir |
| Multi-file output | Self-contained subdirectory |
| Scoped to parent | Nested under parent |

## Safety Rules

- Never move/rename files in `.git/`, `node_modules/`, `.env`
- Never overwrite without confirmation
- Create `.gitkeep` for empty directories
- Respect `.gitignore` patterns
