# Baseline measurements and vendor sources

Measured 2026-11-15 on `main` @ `be6c8baf` (worktree `claude/stoic-leavitt-148682`). Commands are
listed so the after-measurement can repeat them. Vendor pages were opened the same day.

## 1. Starting evidence, re-checked

| Claim in the brief | Re-measured | Verdict |
|---|---|---|
| A1/A2/A5 report 0 findings in three trees | `node scripts/check-instruction-criteria.cjs` → `No findings.` | holds |
| `subagent_type=` in ~19 Codex / ~17 Cursor files, 8 skills | 19 Codex (agent-detector 3, autobuild 6, cook 2, fix 2, plan-creator 3, planning-engine 1, scout 1, trace-analyze 1); 17 Cursor (agent-detector 1, rest equal) | holds |
| `TodoWrite` in 2 Codex files | `mk-cook/references/workflow-steps.md`, `mk-plan-creator/references/task-management.md` | holds |
| 1 Cursor file names `.claude/` | `kit/bundles/cursor/root/.meowkit/README.md` | holds |
| Descriptions 13.9k CC vs ~22.7k Codex / ~22.5k Cursor | `description` 13,834 CC, 22,482 Codex, 22,272 Cursor. **But CC also lists `when_to_use` (8,534), so the CC listing text is 22,368** | **misleading**: the three listings are about equal |
| Emphatic tokens 627 / 515 / 482 | `--metrics` → 627 / 515 / 482 | holds |
| Always-on rules 18,244 B of 18,500 B | holds for Claude Code | holds; **Cursor always-on is understated**: `runtime-invariants.mdc` has `alwaysApply: true` (1,668 B) and is not counted, so Cursor always-on is 6,356 B, not 4,688 B |
| Agents declare the tools they get; `model:` follows the tier table | true on Claude Code (prior plan, `mewkit validate --agents`) | holds on CC; **bundle pins are stale** (below) |

## 2. New findings (not in the brief)

| # | Finding | Evidence |
|---|---|---|
| N1 | 13 Codex agents pin `gpt-5.4-mini`, retired from Codex with ChatGPT sign-in on 2026-08-31; 28 pin `gpt-5.6-sol`/`gpt-5.6-terra`, absent from the current Codex recommended list (`gpt-6-astra`, `gpt-6.1-sol`, `gpt-6.1-terra`, `gpt-6-luna`) | `grep -h '^model = ' kit/bundles/codex/root/.codex/agents/*.toml`; [Codex models] |
| N2 | Cursor agents pin `composer-2.5[fast=true]` (25), `claude-sonnet-5` (8), `claude-opus-5[effort=high]` (5), `claude-fable-5` (3); all listed by Cursor today, none at the newest point release | `grep -h '^model:' kit/bundles/cursor/root/.cursor/agents/*.md`; [Cursor models] |
| N3 | 407 files in each bundle refer to skills as `mk:name`; the bundle skills are named `mk-name` (Codex invokes `$mk-name`, Cursor `/mk-name`) | `grep -rlE '\bmk:[a-z]' kit/bundles/codex/root/.agents/skills \| wc -l` |
| N4 | Skill sets differ: `arch`, `breakdown`, `delegate`, `status` exist only on Claude Code; `rule-advice-supervision` only on Codex. 127 / 124 / 123 skills | `comm -3` of the three skill directory listings |
| N5 | Cursor marks 12 skills `disable-model-invocation: true`; Codex 1; Claude Code 0 | `grep -l '^disable-model-invocation: true'` |
| N6 | Four PostToolUse/PreToolUse observers still answer with plain stdout (`build-verify`, `loop-detection`, `budget-tracker`, `pre-task-check`); host docs say plain stdout on those events is not shown to the model | `.claude/hooks/handlers.json`, `dispatch.cjs:30-46`; host-probe-log P1 (documented, not probed) |
| N7 | Standing delegation instructions (spawn/delegate/`subagent_type`) in 30 CC, 21 Codex, 19 Cursor skill files; re-check phrasing (`double-check`, `re-verify`) in 13 per tree | grep in §4 |
| N8 | Reference files over 100 lines without a contents list: 45 CC, 34 Codex, 34 Cursor | loop in §4 |
| N9 | No SKILL.md exceeds 500 lines in any tree (largest `orchestrate` 358) | `wc -l` |
| N10 | Claude Code skill `name:` values use `mk:fix` with folder `fix/`; Cursor and the Agent Skills spec require lowercase-hyphen names matching the folder, and Cursor also loads `.claude/skills/` | `.claude/skills/fix/SKILL.md:2`; [Cursor skills]; [Anthropic skills best practices] |
| N11 | `.meowkit/memory/decisions.md` and `gotchas.md` do not exist in this checkout; there is no team memory to read | `ls .meowkit` |
| N12 | Rust `validate/denied_tokens.rs` already defines Claude-bound tokens (`AskUserQuestion`, `Task(`, `.claude/`, `CLAUDE.md`, `/mk:`); it runs in `target_codex_skills.rs` against installed output, not the bundle source, and has no `subagent_type`/`TodoWrite` entry | `crates/mewkit-core/src/validate/denied_tokens.rs:15-26` |

## 3. Vendor sources and what each says (paraphrased; quotes under 15 words)

| Source | Point used in this plan |
|---|---|
| [Anthropic skills best practices] | Description says what and when, third person, ≤1,024 chars; SKILL.md body under 500 lines; references one level deep; contents list on references over 100 lines; consistent terms; test on every model you ship to |
| [Anthropic prompting best practices] | Give the reason behind an instruction; soften "CRITICAL: You MUST" to "Use this tool when…" because current models overtrigger |
| [Prompting Claude Fable 5.2] | Review skills/agent files written for earlier models: remove standing delegation lines, token budgets shown to the model, style hard-limits, piled-up cautions; "never" is read as absolute, so state scope and exception; name the steps that need no approval |
| [Prompting Claude Opus 5] | Remove explicit verification steps and "use a subagent to verify": they cause over-verification; give explicit delegation criteria; review prompts that say "only report high-severity" are followed literally |
| [OpenAI prompt guidance] (current GPT-6 guide) | User instructions take precedence over skills; audit skills for behaviour-changing text; say when and how much to use subagents; avoid tests that mirror reversible low-impact changes |
| [Codex skills] | Listing = name, description, path; budget 2% of context or 8,000 chars when unknown; descriptions shortened first, then skills dropped; front-load trigger words; `agents/openai.yaml` `policy.allow_implicit_invocation` |
| [Codex models] | Current ids; `gpt-5.4-mini` retired 2026-08-31 |
| [Cursor skills] | `name` lowercase-hyphen and equal to folder; `paths`, `disable-model-invocation`; loads `.claude/skills` and `.codex/skills` too |
| [Cursor subagents] | `model` accepts `inherit` or id with `[k=v]` options; `readonly`; delegation through the Task tool; one nesting level |
| Prior snapshots, `docs/plans/261115-remove-gates-audit-runtimes-coexistence/research/runtime-docs-index.md` | #18/#65 CC listing: `description`+`when_to_use` capped at 1,536 chars, budget 1% of context; #37 exit 2 on PostToolUse only shows stderr; #51 `additionalContext` capped at 10,000 chars; #60 rules read only `paths`; #61 CLAUDE.md under 200 lines; #68 Codex AGENTS.md concatenation |

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

## 4. Commands

```bash
node scripts/check-instruction-criteria.cjs && node scripts/check-instruction-criteria.cjs --metrics
grep -rl 'subagent_type' kit/bundles/codex/root --include='*.md' | wc -l
grep -rliE "spawn (a|the|an) [a-z-]* ?(sub)?agent|use a subagent|delegate to (the )?[a-z-]+ (sub)?agent|subagent_type" .claude/skills | wc -l
grep -rliE "double-check|re-verify|verify again|re-check your" .claude/skills | wc -l
```

Description totals came from a scratch script that reads `description` and `when_to_use` from
each `SKILL.md` frontmatter; Phase 1 moves that logic into the criteria checker.
