# Directory Rules — Project Organization

## Directory Categories

Every project file belongs to one of these categories:

| Category | Path | Purpose |
|----------|------|---------|
| Source code | `src/` or project root | Application code |
| Documentation | `docs/` | Human + AI readable docs, guides, specs |
| Tasks | `tasks/` | Plans, reviews, reports |
| Tests | `tests/` or `__tests__/` | Test suites |
| Scripts | `scripts/` or the owning skill's `scripts/` | Build, deploy, utility scripts |
| Assets | `assets/{type}/` | Media, branding, designs |
| Config | Root or `.config/` | Dotfiles, config files |
| Kit     | `.claude/` | Agent toolkit (skills, agents, rules, hooks) |

### Paths the kit uses

```
.claude/
├── agents/          Agent definitions
├── skills/          Skills, one directory each (no prefix on the directory)
├── rules/           Always-on rules
├── hooks/           Lifecycle hooks
└── settings.json    Hook registrations

tasks/
├── plans/           YYMMDD-name/ with plan.md + phase-XX-*.md
├── reviews/         YYMMDD-name-verdict.md
├── reports/         Reports by kind (security, retros, trace analysis, ...)
└── contracts/       Signed sprint contracts

.meowkit/
├── memory/          decisions.md and gotchas.md
├── state/           Run state
└── telemetry/       Logs and trace records
```

## Naming Patterns

All filenames use **kebab-case**, self-documenting names.

| Mode | Pattern | Use when | Example |
|------|---------|----------|---------|
| Timestamped | `YYMMDD-{slug}` | Plans, reviews, reports | `260326-auth-plan.md` |
| Evergreen | `{slug}` | Stable docs, configs | `system-architecture.md` |
| Variant | `{slug}-{variant}.{ext}` | Multiple versions | `logo-dark.svg` |

**Slug rules:** lowercase, hyphens only, max 50 chars, no leading or trailing hyphen. A file name that says what the file is lets a search tool find it without opening it.

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

The safety rules live in SKILL.md (Constraints); `.gitkeep` keeps an empty directory tracked.
