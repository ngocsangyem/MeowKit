# Instruction audit criteria

The criteria every rule, agent, skill and bundle instruction file is held to now that MeowKit
has no plan-approval or review-approval gate, and the model-fit checks for current models on
Claude Code, Codex and Cursor. The mechanical subset is checked by
`node scripts/check-instruction-criteria.cjs`, which CI runs on `.claude`,
`kit/bundles/codex/root` and `kit/bundles/cursor/root` against
`scripts/instruction-criteria-baseline.json`; the rest is reviewed by hand against this page.

## Criteria

| Id | Criterion | Applies to | Checked by |
|---|---|---|---|
| A1 | No instruction to obtain or wait for an approval gate (`Gate 1`, `Gate 2`, `HARD GATE`, approval receipts, `gate-rules.md`). Planning and review are described as practices the agent does, not stops it waits at. | every edited file | script |
| A2 | No enforcement claim without a named mechanism. "Enforced by `X`" must name a file that exists; "no bypass" and "hook-enforced" need the hook named. What is enforced on which runtime comes from `docs/core/enforcement-matrix.md`. | every edited file | script (partly), review |
| A3 | Emphatic absolutes (MUST, NEVER, ALWAYS, CAPITALS) only on security and data-safety rules; elsewhere a plain statement with its reason. | rules, agents | review; count reported |
| A4 | No passage duplicated across always-on files. | rules, agents | review |
| A5 | No stale path, verb or file reference: no removed verb (`plan approve`, `validate --gates`, `verdict-gate`) and no deleted gate file. | every edited file | script |
| A6 | No host-specific tool name in text shipped to another runtime; no model-family name used as a condition. | rules, agents | review |
| A7 | An agent's declared tools equal its effective tools; `model:` follows one documented rule. | agents | review, `mewkit validate --agents` |
| A8 | Always-on bytes do not grow (Claude Code rules; each bundle's `AGENTS.md`; on Cursor also every `.mdc` rule with `alwaysApply: true`). | rules, `AGENTS.md` | script |
| A9 | No Claude Code tool syntax in a bundle: the tokens in `scripts/lib/host-foreign-tokens.json` (`subagent_type`, `TodoWrite`, `ExitPlanMode`, `AskUserQuestion`, `Task(`, `Skill tool`, `.claude/`, `CLAUDE.md`, `/mk:`, Claude env vars). Cursor may name its Task tool; Codex may not. | bundle trees | script |
| A10 | Skill references use the host's name form: `mk-x` (invoked `$mk-x` on Codex, `/mk-x` on Cursor) in bundles, `mk:x` on Claude Code. | every file | script |
| A11 | Skill description in third person, no first- or second-person opener, ≤1,024 chars; on Claude Code `description` + `when_to_use` ≤1,536 chars. Each tree's listing total stays at or under its ceiling: Claude Code 16,000, Codex 12,000, Cursor 16,000 chars (chosen 2026-11-16; Codex is lower so a 128k-context session keeps whole descriptions). The ceiling is never baselined. | `SKILL.md` frontmatter | script |
| A12 | Progressive disclosure: `SKILL.md` ≤500 lines; a reference over 100 lines opens with a contents list; a reference does not send the reader on to another file (one level deep). | skills | script, growth-only |
| A13 | An agent's `model` is a row in `docs/maintainer/model-pins.md` for its runtime, and that row is not `retired`, `deprecated` or `not listed`. | agents | script |
| A14 | No standing re-verify wording (`double-check`, `re-verify`, `verify again`, `re-check your`); a delegate line ("spawn a … agent", "use a subagent", "delegate to … agent") states its condition on the same line. | every file | script, growth-only |

**Baseline.** Findings that predate a criterion are recorded per file in
`scripts/instruction-criteria-baseline.json`; with `--baseline` a file fails only when it has more
than its recorded count, and also when a file has fewer, so a fix must lower the recorded count
(otherwise the room left over would let a different finding in). Regenerate it with
`--write-baseline` after text is fixed, never to hide a new finding; with tree arguments it
rewrites only those trees' entries. A8 and the pinned-text hash are never baselined. A line that really needs a flagged
phrase carries `<!-- criteria-allow: A14 -->` (any criterion code) and is waived on that line only.

The blocked-pattern table in `security-rules.md` and the numbered rules in `injection-rules.md`
are pinned by hash: the script fails if either changes. Their own wording ("bypass gates") is
exempt from A1.

## What "fits" means, per artefact and runtime

Each line cites a vendor page opened on 2026-11-15. Pages: [Anthropic skills best practices],
[Anthropic prompting best practices], [Prompting Claude Fable 5.2], [Prompting Claude Opus 5],
[OpenAI prompt guidance], [Codex skills], [Codex models], [Cursor skills], [Cursor subagents],
[Cursor models], [Claude Code model config].

| Artefact | Claude Code | Codex | Cursor | Criteria |
|---|---|---|---|---|
| Always-on rule | Every `.claude/rules/*.md` loads each turn: keep it short and give the reason with each instruction; reserve absolutes for security and data safety, because current models read "never" as absolute ([Anthropic prompting best practices], [Prompting Claude Fable 5.2]) | `AGENTS.md` is concatenated into every turn; user instructions outrank it ([OpenAI prompt guidance]) | `AGENTS.md` plus `.mdc` rules with `alwaysApply: true` | A3, A4, A8 |
| `AGENTS.md` / `CLAUDE.md` | Pointer file, short; no duplicated rule text | Same, and only Codex tool names | Same, and only Cursor tool names | A4, A6, A9 |
| Agent | `model` follows the tier table; tools declared equal tools granted | `model` from the current Codex list; retired ids fail ([Codex models]) | `model` is `inherit` or a listed id with optional `[k=v]` options; read-only agents say so ([Cursor subagents], [Cursor models]) | A7, A13 |
| Skill description | What and when, third person, front-loaded trigger words; `description` + `when_to_use` cut at 1,536 chars ([Anthropic skills best practices]) | Listing = name, description, path within ~2% of context; descriptions are shortened first, then skills dropped ([Codex skills]) | `name` lowercase-hyphen equal to the folder; `disable-model-invocation` hides a skill ([Cursor skills]) | A10, A11 |
| Skill body | Under 500 lines; references one level deep; a contents list on references over 100 lines ([Anthropic skills best practices]); no standing "use a subagent to verify" or re-check steps, which cause over-verification ([Prompting Claude Opus 5]); delegation states when ([Prompting Claude Fable 5.2]) | Same; say when and how much to use subagents ([OpenAI prompt guidance]) | Same; delegation through the Task tool, one nesting level ([Cursor subagents]) | A9, A10, A12, A14 |
| Hook message | Reaches the model only on a channel the host shows it (stderr on exit 2, `additionalContext`); plain stdout on tool events is not shown | Same principle in Codex's hook form | Same principle in Cursor's hook form | review |

## What replaces the gates

- **Planning.** For a change of more than two files or a few hours, write the plan and agree
  it with the user before building. Nothing blocks an edit without one.
- **Review.** Review the diff before shipping and record the verdict. Nothing blocks a commit
  on the verdict.
- **Ship check.** On a commit, push, merge or `gh pr create|merge`, a hook runs lint, the tests
  related to the changed files and a type-check, and refuses the command when one fails. It is
  the one ship-time control, on all three runtimes.
- **Irreversible actions.** Push, merge and force are approved through the host's own
  permission prompt when the host is set to ask; MeowKit does not add a gate of its own.

## Model-fit audit: before and after

Measured with `node scripts/check-instruction-criteria.cjs --metrics`. The A9–A14 columns count
finding lines. Listing chars are `description` (plus `when_to_use` on Claude Code) summed over
every skill.

### Before (2026-11-15, `main` @ `be6c8baf`, criteria A9–A14 added, no text changed)

| Tree | Text files | Always-on bytes | Gate phrases | Emphatic tokens | Emphatic outside pinned rules | Skills | Listing chars | A9 | A10 | A11 | A12 | A13 | A14 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| .claude | 912 | 18244 | 0 | 627 | 616 | 127 | 22368 | 0 | 0 | 0 | 72 | 0 | 14 |
| kit/bundles/codex/root | 849 | 7745 | 0 | 515 | 515 | 124 | 22482 | 63 | 2038 | 0 | 51 | 41 | 10 |
| kit/bundles/cursor/root | 853 | 6356 | 0 | 482 | 482 | 123 | 22272 | 57 | 1915 | 0 | 51 | 0 | 10 |

The Cursor always-on figure now counts `runtime-invariants.mdc` (`alwaysApply: true`), so it
reads 6,356 B where the gate-removal table read 4,688 B; the text did not change. Claude Code has
912 text files where that table had 911 because the `memory` skill folder is now walked.
Before this change, `mk-planning-engine/SKILL.md` in both bundles called `Agent(subagent_type: …)`;
those two lines were reworded so installed-Codex validation stays green with the new token.

### After

Recorded when the model-fit audit closes.

## Gate removal: before and after

Measured with `node scripts/check-instruction-criteria.cjs --metrics` over every `.md` and
`.mdc` file in each tree. Always-on bytes are the rule files on Claude Code and `AGENTS.md` on
the bundles.

### Before (2026-11-15, gates removed from hooks and CLI, text not yet rewritten)

| Tree | Text files | Always-on bytes | Gate phrases | Emphatic tokens |
|---|---|---|---|---|
| .claude | 914 | 25420 | 512 | 640 |
| kit/bundles/codex/root | 809 | 7756 | 342 | 478 |
| kit/bundles/cursor/root | 855 | 4702 | 333 | 485 |

### After (2026-11-15, gate text rewritten in all three trees)

| Tree | Text files | Always-on bytes | Gate phrases | Emphatic tokens |
|---|---|---|---|---|
| .claude | 911 | 18244 | 0 | 627 |
| kit/bundles/codex/root | 849 | 7745 | 0 | 515 |
| kit/bundles/cursor/root | 853 | 4688 | 0 | 482 |

The always-on ceilings in `scripts/check-instruction-criteria.cjs` and
`scripts/check-always-on-budget.cjs` were lowered to these sizes (Claude Code rules 18500 B, a
little headroom for the canonical-source pointer and one short rule line). The headless smoke set
was not run: live model runs were declined for this change.

[Anthropic skills best practices]: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
[Anthropic prompting best practices]: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
[Prompting Claude Fable 5.2]: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-2
[Prompting Claude Opus 5]: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5
[OpenAI prompt guidance]: https://developers.openai.com/api/docs/guides/prompt-guidance
[Codex skills]: https://learn.chatgpt.com/docs/build-skills
[Codex models]: https://learn.chatgpt.com/docs/models
[Cursor skills]: https://cursor.com/docs/context/skills
[Cursor subagents]: https://cursor.com/docs/context/subagents
[Cursor models]: https://cursor.com/docs/models
[Claude Code model config]: https://code.claude.com/docs/en/model-config
