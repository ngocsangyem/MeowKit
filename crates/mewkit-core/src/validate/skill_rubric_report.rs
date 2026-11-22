//! What the rubric scores print as: one `validate` row per skill, and the JSON
//! report with the thresholds and every skill's measures and verdicts.
use serde_json::{Value, json};

use super::result::{CheckResult, Section, Status};
use super::skill_rubric::{
    CHARS_PER_TOKEN, CRITERIA, DESCRIPTION_MAX_CHARS, DUPLICATE_MIN_WORDS,
    EMPHASIS_MAX_PER_1000_WORDS, ENTRY_MAX_TOKENS, FALLBACK_WINDOW, LISTING_MAX_CHARS,
    SkillRubricRow,
};

/// The failed criteria, each with the value that failed it.
pub fn failures(row: &SkillRubricRow) -> Vec<String> {
    let mut out = Vec::new();
    if !row.pass_description() {
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
        let mut why = Vec::new();
        if !missing.is_empty() {
            why.push(format!("missing {}", missing.join(", ")));
        }
        if d.description_chars > DESCRIPTION_MAX_CHARS || d.listing_chars > LISTING_MAX_CHARS {
            why.push(format!("{} listing chars", d.listing_chars));
        }
        out.push(format!("description: {}", why.join("; ")));
    }
    if !row.pass_entry() {
        out.push(format!(
            "entry: ~{} tokens, over {ENTRY_MAX_TOKENS}",
            row.entry.tokens
        ));
    }
    if !row.pass_references() {
        out.push(format!("dead references: {}", row.dead_references.len()));
    }
    if !row.pass_emphasis() {
        out.push(format!(
            "emphasis: {:.1} per 1,000 words",
            row.emphasis.per_1000_words()
        ));
    }
    if !row.pass_harness_tools() {
        out.push(format!(
            "harness tools without fallback: {}",
            row.harness_tools.len()
        ));
    }
    if !row.pass_duplicates() {
        out.push(format!(
            "duplicated passages: {} (with {})",
            row.duplicates.passages,
            row.duplicates.shared_with.join(", ")
        ));
    }
    out
}

/// One row per skill: PASS when every criterion passes, otherwise WARN naming
/// the failed criteria. Never FAIL — the scores are recorded, not gated.
pub fn skill_rubric_rows(rows: &[SkillRubricRow]) -> Vec<CheckResult> {
    if rows.is_empty() {
        return vec![CheckResult::new(
            "Skill rubric",
            Status::Na,
            "no skills under .claude/skills/",
            Section::Skills,
        )];
    }
    rows.iter()
        .map(|row| {
            let name = format!(
                "Skill rubric: {} ({} of {CRITERIA})",
                row.skill,
                row.score()
            );
            let failures = failures(row);
            let status = if failures.is_empty() {
                Status::Pass
            } else {
                Status::Warn
            };
            CheckResult::new(name, status, failures.join("; "), Section::Skills)
        })
        .collect()
}

/// The report file: thresholds, then one object per skill with each value.
pub fn skill_rubric_report(rows: &[SkillRubricRow]) -> Value {
    let skills: Vec<Value> = rows.iter().map(row_json).collect();
    json!({
        "schema": 1,
        "criteria": CRITERIA,
        "thresholds": {
            "description_max_chars": DESCRIPTION_MAX_CHARS,
            "listing_max_chars": LISTING_MAX_CHARS,
            "entry_max_tokens": ENTRY_MAX_TOKENS,
            "chars_per_token": CHARS_PER_TOKEN,
            "emphasis_max_per_1000_words": EMPHASIS_MAX_PER_1000_WORDS,
            "fallback_window_lines": FALLBACK_WINDOW,
            "duplicate_min_words": DUPLICATE_MIN_WORDS,
        },
        "skills": skills,
    })
}

fn row_json(row: &SkillRubricRow) -> Value {
    let d = &row.description;
    json!({
        "skill": row.skill,
        "score": row.score(),
        "description": {
            "pass": row.pass_description(),
            "description_chars": d.description_chars,
            "listing_chars": d.listing_chars,
            "states_what": d.states_what,
            "states_when": d.states_when,
            "states_when_not": d.states_when_not,
        },
        "entry": {
            "pass": row.pass_entry(),
            "chars": row.entry.chars,
            "lines": row.entry.lines,
            "tokens": row.entry.tokens,
        },
        "dead_references": { "pass": row.pass_references(), "found": row.dead_references },
        "emphasis": {
            "pass": row.pass_emphasis(),
            "marks": row.emphasis.marks,
            "words": row.emphasis.words,
            "per_1000_words": (row.emphasis.per_1000_words() * 10.0).round() / 10.0,
        },
        "harness_tools": { "pass": row.pass_harness_tools(), "unhedged": row.harness_tools },
        "duplicated_passages": {
            "pass": row.pass_duplicates(),
            "passages": row.duplicates.passages,
            "shared_with": row.duplicates.shared_with,
        },
    })
}
