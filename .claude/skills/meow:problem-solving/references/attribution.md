# Attribution

## Sources (in order of contribution)

### 1. claudekit-engineer problem-solving skill (v2.0.0)

Primary source. Supplied 5 core techniques and the `when-stuck` dispatch pattern.

- Techniques supplied:
  - `simplification-cascades.md`
  - `collision-zone-thinking.md`
  - `meta-pattern-recognition.md`
  - `inversion-exercise.md`
  - `scale-game.md`
  - `when-stuck.md` (dispatch flowchart)

### 2. microsoft/amplifier (insight-synthesizer agent)

Original lineage of the 5 core techniques. Claudekit adapted these from Amplifier; meowkit adapted them further.

- Repository: https://github.com/microsoft/amplifier
- Commit referenced by claudekit: `2adb63f858e7d760e188197c8e8d4c1ef721e2a6` (2025-10-10)
- License: MIT

### 3. cc-thinking-skills (TJ Boudreaux)

Supplied `first-principles.md` and `via-negativa.md` as strategic-unsticking techniques not covered by the other 5.

- Repository: https://github.com/tjboudreaux/cc-thinking-skills
- License: MIT
- Skills adapted:
  - `thinking-first-principles` → `first-principles.md`
  - `thinking-via-negativa` → `via-negativa.md`

## Changes in Adaptation

### Preserved

- Core techniques and their insight-level content
- Concrete examples (adapted to software-engineering hits where source was domain-neutral)
- Red-flag patterns for each technique
- Application process steps

### Changed

- **Tone:** compressed from academic (cc-thinking) to imperative (meowkit style). Cut templates over 20 lines; cut "Feynman's wisdom" / "Taleb's wisdom" narrative sections.
- **Cross-references:** all `ck:` references rewritten to `meow:`. `systematic-debugging` / "debugging skill" references rewritten to `meow:sequential-thinking` or `meow:fix` as appropriate.
- **Boundary pointer:** explicit reroute to `meow:fix` (for bug-fix intent) and `meow:sequential-thinking` (for pure diagnostic reasoning), added to SKILL.md and `when-stuck.md`.
- **Bridge lines:** each technique references its nearest sibling to reduce "which one do I use" friction.
- **Gotchas section:** added in SKILL.md (non-obvious failure modes per technique) per `lessons-build-skill.md`.
- **File budget:** each reference kept under 150 lines. Sources that ran 300–640 lines (cc-thinking first-principles, via-negativa) compressed to 70–100 lines.

## Excluded from Adaptation (documented audit)

Full audit of all 39 cc-thinking-skills conducted 2026-04-19. Report:
`plans/260419-0103-adapt-thinking-skills-option-b/reports/cc-thinking-skills-audit-260419.md`

**Result:** 38 of 39 excluded. The auditor recommended one INCLUDE (`thinking-archetypes`). Tech-lead rejected on YAGNI grounds — no user-reported gap, dispatch-table precision preferred over catalog breadth. Three candidates flagged as "deferred, not dead":

- `thinking-archetypes` — if organizational / systemic-dysfunction patterns appear in >2 real stuck-moments
- `thinking-triz` — if contradiction-resolution moments aren't served by Collision-Zone + Inversion
- `thinking-theory-of-constraints` — if bottleneck-framing adds precision beyond general performance work

The 3 diagnostic cc-thinking skills (`thinking-five-whys-plus`, `thinking-scientific-method`, `thinking-kepner-tregoe`) were moved to `meow:sequential-thinking/references/` instead — they fit the evidence-based diagnosis axis, not the strategic-unsticking axis of this skill.

## License

MIT (matches both upstream sources). Attribution maintained per MIT terms.
