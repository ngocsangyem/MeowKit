//! The skill-audit docs page: the mechanical rubric table for every shipped
//! skill, rendered from the same scores `mewkit validate --skill-rubric` writes.
//! Generated so the published table cannot fall behind the skills it scores.
use std::collections::BTreeMap;
use std::path::Path;

use super::generated::GeneratedFile;
use super::table_cell::table_cell;
use crate::validate::{SKILL_RUBRIC_CRITERIA, SkillRubricRow, score_skills};

pub const SKILL_AUDIT_PAGE_REL: &str = "packages/docs/content/docs/guide/skill-audit.mdx";

/// Skills whose paired eval cases exist but whose baseline has not been run.
const PAIRED_CASES: [&str; 4] = ["cook", "fix", "investigate", "plan-creator"];

const HEADER: &str = r#"---
title: "Skill Audit"
description: "Every shipped skill scored on the rubric criteria a program can check: description shape, entry size, dead references, emphasis, harness tool names and duplicated passages."
---

{/* Generated from the skill rubric check. Do not edit by hand: run
    `MEWKIT_BLESS=1 cargo test -p mewkit-core --test bless_skill_audit` and commit the result. */}

This table scores each skill on six criteria that `mewkit validate --skill-rubric` measures from the files alone. A skill earns one point per criterion it passes. The scores say how a skill is written by these measures, not whether it works better: no skill below has a behavioural result yet. Criteria that need a reader (goal and completion, degrees of freedom, hand-off, exits, verification, determinism) are not in this table.

Run `mewkit validate --skill-rubric` in a kit checkout to get the same values as JSON in `.meowkit/telemetry/skill-rubric.json` (or the path given to `--skill-rubric-report`). The rows are PASS or WARN and never fail the run.

## Criteria and thresholds

| Criterion | Passes when |
|---|---|
| Description | The description says what the skill does, when to use it (`when_to_use` or a "when" clause) and when not to ("NOT for ..."); description at most 1,024 characters and description plus `when_to_use` at most 1,536 |
| Entry | `SKILL.md` is at most 5,000 estimated tokens (characters / 4), so all of it returns after compaction |
| Dead refs | No skill link, slash command or docs reference in the skill's files points at something the kit does not ship |
| Emphasis | At most 10 emphatic marks (MUST, NEVER, ALWAYS, IMPORTANT, CRITICAL, NON-NEGOTIABLE, MANDATORY, or a bold span in capitals) per 1,000 words of the `SKILL.md` body |
| Harness tools | Every harness-only tool name (`AskUserQuestion`, `TodoWrite`, `TaskCreate` and siblings, `SendMessage`, `Agent(`, `Task(`) has a fallback stated within 3 lines |
| Duplicates | No paragraph of 40 or more words is copied word for word into another skill; copies listed in `.claude/shared-families.json` are kept identical on purpose and not counted |

"#;

fn verdict(pass: bool, value: String) -> String {
    if pass { value } else { format!("**{value}**") }
}

fn description_cell(row: &SkillRubricRow) -> String {
    let d = &row.description;
    let missing: Vec<&str> = [
        (d.states_what, "what"),
        (d.states_when, "when"),
        (d.states_when_not, "when-not"),
    ]
    .iter()
    .filter(|(present, _)| !present)
    .map(|(_, part)| *part)
    .collect();
    let text = if missing.is_empty() {
        format!("{} chars", d.listing_chars)
    } else {
        format!("no {}, {} chars", missing.join("/"), d.listing_chars)
    };
    verdict(row.pass_description(), text)
}

fn table_row(row: &SkillRubricRow) -> String {
    let behaviour = if PAIRED_CASES.contains(&row.skill.as_str()) {
        "paired cases written, baseline not yet run"
    } else {
        "not behaviour-tested"
    };
    let cells = [
        format!("`{}`", table_cell(&row.skill)),
        format!("{} of {SKILL_RUBRIC_CRITERIA}", row.score()),
        description_cell(row),
        verdict(row.pass_entry(), format!("~{}", row.entry.tokens)),
        verdict(row.pass_references(), row.dead_references.len().to_string()),
        verdict(
            row.pass_emphasis(),
            format!("{:.1}", row.emphasis.per_1000_words()),
        ),
        verdict(
            row.pass_harness_tools(),
            row.harness_tools.len().to_string(),
        ),
        verdict(row.pass_duplicates(), row.duplicates.passages.to_string()),
        behaviour.to_string(),
    ];
    format!("| {} |", cells.join(" | "))
}

fn summary(rows: &[SkillRubricRow]) -> String {
    let mut by_score: BTreeMap<usize, usize> = BTreeMap::new();
    for row in rows {
        *by_score.entry(row.score()).or_default() += 1;
    }
    let distribution: Vec<String> = by_score
        .iter()
        .rev()
        .map(|(score, n)| format!("{n} at {score} of {SKILL_RUBRIC_CRITERIA}"))
        .collect();
    let failing = |pass: fn(&SkillRubricRow) -> bool| rows.iter().filter(|r| !pass(r)).count();
    format!(
        "## Summary\n\n{} skills: {}.\n\nSkills failing each criterion: description {}, entry {}, dead refs {}, emphasis {}, harness tools {}, duplicates {}.\n\n",
        rows.len(),
        distribution.join(", "),
        failing(SkillRubricRow::pass_description),
        failing(SkillRubricRow::pass_entry),
        failing(SkillRubricRow::pass_references),
        failing(SkillRubricRow::pass_emphasis),
        failing(SkillRubricRow::pass_harness_tools),
        failing(SkillRubricRow::pass_duplicates),
    )
}

/// Render the page: lowest score first, then by name; a failed value in bold.
pub fn render_skill_audit_page(rows: &[SkillRubricRow]) -> String {
    let mut sorted: Vec<&SkillRubricRow> = rows.iter().collect();
    sorted.sort_by(|a, b| a.score().cmp(&b.score()).then(a.skill.cmp(&b.skill)));
    let mut out = String::from(HEADER);
    out.push_str(&summary(rows));
    out.push_str("## Scores\n\nA value in bold failed its criterion. Description shows the listing length (description plus `when_to_use`); Entry is estimated tokens; Emphasis is marks per 1,000 words.\n\n");
    out.push_str("| Skill | Score | Description | Entry | Dead refs | Emphasis | Harness tools | Duplicates | Behaviour |\n");
    out.push_str("|---|---|---|---|---|---|---|---|---|\n");
    for row in sorted {
        out.push_str(&table_row(row));
        out.push('\n');
    }
    out
}

/// The committed page, scored from `<root>/.claude`.
pub fn skill_audit_file(root: &Path) -> GeneratedFile {
    let rows = score_skills(&root.join(".claude"));
    GeneratedFile::new(SKILL_AUDIT_PAGE_REL, render_skill_audit_page(&rows))
}
