# Model pins

The one list of model ids an agent file may pin, per runtime. `node scripts/check-instruction-criteria.cjs`
(criterion A13) reads the table below: an agent `model` value must have a row for its runtime, and
the row's status must not be `retired`, `deprecated` or `not listed`. Cursor option suffixes such
as `[fast=true]` are stripped before the lookup.

Update a row when the vendor page changes, and put the date you opened the page in **Checked**.
A status is copied from the vendor page, not inferred: when the page does not name an id, the
status is `not listed`.

## Tier mapping

Each agent's pin follows its Claude Code tier (the table in
`.claude/skills/agent-detector/references/model-selection-rules.md`); the bundles derive from it.
Chosen 2026-11-15.

| Claude Code tier | Claude Code | Codex | Cursor |
|---|---|---|---|
| haiku | `haiku` | `gpt-6-luna` | `composer-2.5[fast=true]` |
| sonnet | `sonnet` | `gpt-6.1-sol` | `composer-2.5[fast=true]` |
| opus | `opus` | `gpt-6-astra` | `claude-opus-5[effort=high]` |
| fable | `fable` | `gpt-6-astra` | `claude-fable-5` |

On Codex, Enterprise and Edu admins must enable `gpt-6-luna` before it can run.

## Pins

| Id | Runtime | Status | Source | Checked | Notes |
|---|---|---|---|---|---|
| `sonnet` | claude-code | alias | [Claude Code model config] | 2026-11-15 | Latest Sonnet: 5.5 on the Anthropic API; older on some cloud providers |
| `haiku` | claude-code | alias | [Claude Code model config] | 2026-11-15 | Haiku 5.5 on the Anthropic API; 4.5 elsewhere |
| `opus` | claude-code | alias | [Claude Code model config] | 2026-11-15 | Latest Opus: 5.5 on most providers |
| `fable` | claude-code | alias | [Claude Code model config] | 2026-11-15 | Fable 5.2 unless `ANTHROPIC_DEFAULT_FABLE_MODEL` is set |
| `inherit` | claude-code | listed | [Claude Code subagents] | 2026-11-15 | Uses the session model |
| `claude-opus-5` | claude-code | listed | [Claude Code model config] | 2026-11-15 | Version prefix; the page pins with full ids such as `claude-opus-5-5` |
| `claude-opus-5-5` | claude-code | listed | [Claude Code model config] | 2026-11-15 | Full id given as the pinning example |
| `gpt-6-astra` | codex | recommended | [Codex models] | 2026-11-15 | Most capable |
| `gpt-6.1-sol` | codex | recommended | [Codex models] | 2026-11-15 | Default in the sample `config.toml` |
| `gpt-6.1-terra` | codex | recommended | [Codex models] | 2026-11-15 | Needs Codex CLI 0.159.0 or later |
| `gpt-6-luna` | codex | recommended | [Codex models] | 2026-11-15 | Named replacement for `gpt-5.4-mini`; Enterprise/Edu admins enable it first |
| `gpt-5.5` | codex | retired | [Codex models] | 2026-11-15 | Retired with ChatGPT sign-in 2026-10-14; API-key sessions unaffected |
| `gpt-5.4` | codex | retired | [Codex models] | 2026-11-15 | Retired 2026-08-31 |
| `gpt-5.4-mini` | codex | retired | [Codex models] | 2026-11-15 | Retired 2026-08-31 |
| `gpt-5.6-sol` | codex | not listed | [Codex models] | 2026-11-15 | Not on the Codex page; Cursor lists it |
| `gpt-5.6-terra` | codex | not listed | [Codex models] | 2026-11-15 | Not on the Codex page; Cursor lists it |
| `inherit` | cursor | listed | [Cursor subagents] | 2026-11-15 | Uses the parent agent's model |
| `composer-2.5` | cursor | listed | [Cursor models] | 2026-11-15 | Composer 2.5; `[fast=true]` selects the Fast variant |
| `claude-sonnet-5` | cursor | listed | [Cursor models] | 2026-11-15 | Claude Sonnet 5; Sonnet 5.5 is also listed |
| `claude-opus-5` | cursor | listed | [Cursor models] | 2026-11-15 | Claude Opus 5; Opus 5.5 is also listed |
| `claude-fable-5` | cursor | listed | [Cursor models] | 2026-11-15 | Claude Fable 5; 5.1 and 5.2 are also listed |

The Cursor models page shows display names, not ids; the Cursor ids above are the ones the
bundle's agents already use. Newer point releases (Sonnet 5.5, Opus 5.5, Fable 5.2) get a row
once their id form is confirmed on a Cursor page.

[Claude Code model config]: https://code.claude.com/docs/en/model-config
[Claude Code subagents]: https://code.claude.com/docs/en/sub-agents
[Codex models]: https://learn.chatgpt.com/docs/models
[Cursor models]: https://cursor.com/docs/models
[Cursor subagents]: https://cursor.com/docs/context/subagents
