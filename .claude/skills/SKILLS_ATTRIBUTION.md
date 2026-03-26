# MeowKit Skills Attribution

Skills in this directory are sourced from open-source repositories.
Each skill retains its original author credit in its frontmatter.

## Sources

| #   | Skill                 | Author                       | Source Repo                                                  | License     | Original Path                                   | Tier |
| --- | --------------------- | ---------------------------- | ------------------------------------------------------------ | ----------- | ----------------------------------------------- | ---- |
| 1   | careful               | garrytan (gstack)            | [gstack](https://github.com/garrytan/gstack)                 | MIT         | gstack/careful/SKILL.md                         | 1    |
| 2   | ship                  | garrytan (gstack)            | [gstack](https://github.com/garrytan/gstack)                 | MIT         | gstack/ship/SKILL.md                            | 1    |
| 3   | freeze                | garrytan (gstack)            | [gstack](https://github.com/garrytan/gstack)                 | MIT         | gstack/freeze/SKILL.md                          | 1    |
| 4   | review                | garrytan (gstack)            | [gstack](https://github.com/garrytan/gstack)                 | MIT         | gstack/review/SKILL.md. Updated 260326: +input modes, +verdict template, +phase anchoring (ck:code-review sync) | 1    |
| 5   | cook                  | mrgoonie (claudekit)         | [claudekit-engineer](https://claudekit.cc)                   | Proprietary | claudekit/.claude/skills/meow:cook/SKILL.md     | 1    |
| 6   | investigate           | garrytan (gstack)            | [gstack](https://github.com/garrytan/gstack)                 | MIT         | gstack/investigate/SKILL.md                     | 1    |
| 7   | clean-code            | vudovn (antigravity-kit)     | [antigravity-kit](https://github.com/vudovn/antigravity-kit) | MIT         | .agent/skills/clean-code/SKILL.md               | 1    |
| 8   | lint-and-validate     | vudovn (antigravity-kit)     | [antigravity-kit](https://github.com/vudovn/antigravity-kit) | MIT         | .agent/skills/lint-and-validate/SKILL.md        | 1    |
| 9   | cso                   | garrytan (gstack)            | [gstack](https://github.com/garrytan/gstack)                 | MIT         | gstack/cso/SKILL.md                             | 1    |
| 10  | fix                   | mrgoonie (claudekit)         | [claudekit-engineer](https://claudekit.cc)                   | Proprietary | claudekit/.claude/skills/meow:fix/SKILL.md      | 1    |
| 11  | agent-detector        | nguyenthienthanh (aura-frog) | [aura-frog](https://github.com/nguyenthienthanh/aura-frog)   | Unknown     | aura-frog/skills/agent-detector/SKILL.md        | 2    |
| 12  | browse                | garrytan (gstack)            | [gstack](https://github.com/garrytan/gstack)                 | MIT         | gstack/browse/SKILL.md                          | 2    |
| 13  | qa                    | garrytan (gstack)            | [gstack](https://github.com/garrytan/gstack)                 | MIT         | gstack/qa/SKILL.md                              | 2    |
| 14  | office-hours          | garrytan (gstack)            | [gstack](https://github.com/garrytan/gstack)                 | MIT         | gstack/office-hours/SKILL.md                    | 2    |
| 15  | vulnerability-scanner | vudovn (antigravity-kit)     | [antigravity-kit](https://github.com/vudovn/antigravity-kit) | MIT         | .agent/skills/vulnerability-scanner/SKILL.md    | 2    |
| 16  | plan-ceo-review       | garrytan (gstack)            | [gstack](https://github.com/garrytan/gstack)                 | MIT         | gstack/plan-ceo-review/SKILL.md                 | 2    |
| 17  | plan-eng-review       | garrytan (gstack)            | [gstack](https://github.com/garrytan/gstack)                 | MIT         | gstack/plan-eng-review/SKILL.md                 | 2    |
| 18  | lazy-agent-loader     | nguyenthienthanh (aura-frog) | [aura-frog](https://github.com/nguyenthienthanh/aura-frog)   | Unknown     | aura-frog/skills/lazy-agent-loader/SKILL.md     | 2    |
| 19  | document-release      | garrytan (gstack)            | [gstack](https://github.com/garrytan/gstack)                 | MIT         | gstack/document-release/SKILL.md                | 2    |
| 20  | workflow-orchestrator | nguyenthienthanh (aura-frog) | [aura-frog](https://github.com/nguyenthienthanh/aura-frog)   | Unknown     | aura-frog/skills/workflow-orchestrator/SKILL.md | 2    |
| 21  | retro                 | garrytan (gstack)            | [gstack](https://github.com/garrytan/gstack)                 | MIT         | gstack/retro/SKILL.md                           | 2    |
| 22  | session-continuation  | nguyenthienthanh (aura-frog) | [aura-frog](https://github.com/nguyenthienthanh/aura-frog)   | Unknown     | aura-frog/skills/session-continuation/SKILL.md  | 2    |
| 23  | docs-finder           | MeowKit (original)           | Inspired by claudekit-engineer/docs-seeker                   | MIT         | .claude/skills/docs-finder/                     | 1    |
| 24  | multimodal            | MeowKit (original)           | Inspired by claudekit-engineer/ai-multimodal                 | MIT         | .claude/skills/meow:multimodal/                 | 1    |
| 25  | scout                 | MeowKit (adapted)            | Adapted from claudekit-engineer/scout. Updated 260326: +search tiers, +arch fingerprint, +handoff protocol | MIT | .claude/skills/meow:scout/ | 1 |

## Selection Criteria

Skills were selected by scoring 5 criteria (weighted total, max 50):

- Clarity (2×), Reusability (2×), Agent Empowerment (3×), Task-Size Coverage (2×), Production Evidence (1×)

Threshold: Tier 1 ≥ 40, Tier 2 = 30-39.

## By Source

| Source             | Skills selected | Total available | Selection rate |
| ------------------ | --------------- | --------------- | -------------- |
| gstack             | 13              | 28              | 46%            |
| antigravity-kit    | 3               | 48              | 6%             |
| aura-frog          | 4               | 43              | 9%             |
| claudekit-engineer | 2               | 68              | 3%             |
| MeowKit (original) | 1               | —               | —              |
| **Total**          | **23**          | **187+**        | —              |

## Modifications

All skills had the following changes (no content modifications):

- Attribution frontmatter prepended (name, source, author, original_path, task_sizes, meowkit_tier)
- Path references updated: `.agent/` → `.claude/`, `.claude/skills/gstack/` → `.claude/skills/`

No instruction content was rewritten in any skill.

## Duplicates Resolved

Skills that overlap with existing MeowKit skills (in .claude/skills/planning/, testing/, review/, shipping/, etc.) were included because the sourced versions are more comprehensive. The MeowKit originals remain in their subdirectories and serve as simplified fallbacks.

| Concept        | MeowKit original              | Sourced skill                              | Resolution                                                                 |
| -------------- | ----------------------------- | ------------------------------------------ | -------------------------------------------------------------------------- |
| Ship pipeline  | shipping/ship-pipeline.md     | ship/SKILL.md (gstack)                     | Both kept — gstack version is comprehensive, MeowKit version is simplified |
| Code review    | review/structural-audit.md    | review/SKILL.md (gstack)                   | Both kept — different scope                                                |
| Security audit | review/security-checklist.md  | cso/SKILL.md (gstack)                      | Both kept — different scope                                                |
| TDD            | testing/red-green-refactor.md | workflow-orchestrator/SKILL.md (aura-frog) | Both kept — different granularity                                          |
