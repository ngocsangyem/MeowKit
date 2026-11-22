//! `validate --skill-rubric`: every skill scored on the rubric criteria a
//! program can check.
//!
//! Six criteria, each pass or fail against a stated threshold: the description
//! says what, when and when not within the listing limits; the entry file fits
//! in the first 5,000 tokens; no dead references; emphasis density; harness
//! tool names with a fallback nearby; no paragraphs copied from another skill.
//! The score is the number passed. The rows record — they are PASS or WARN,
//! never FAIL, so a kit with low scores still validates; the thresholds say
//! where a skill stands, not whether the build may ship. Judged criteria (goal,
//! hand-off, exits, verification) are out of scope: a program cannot read them.
use std::collections::BTreeMap;
use std::path::Path;

use super::docs_refs::check_docs_references;
use super::docs_refs_links::check_skill_links;
use super::frontmatter::skill_names;
pub use super::skill_rubric_duplicates::{DUPLICATE_MIN_WORDS, DuplicateMeasure};
use super::skill_rubric_duplicates::{markdown_files, measure_duplicates};
pub use super::skill_rubric_measures::{
    CHARS_PER_TOKEN, DescriptionMeasure, EmphasisMeasure, EntryMeasure, FALLBACK_WINDOW,
};
use super::skill_rubric_measures::{
    measure_description, measure_emphasis, measure_entry, unhedged_tool_names,
};

/// The per-description limit hosts enforce.
pub const DESCRIPTION_MAX_CHARS: usize = 1024;
/// Claude Code lists description and `when_to_use` together and cuts at this.
pub const LISTING_MAX_CHARS: usize = 1536;
/// Only the first 5,000 tokens of a skill return after compaction.
pub const ENTRY_MAX_TOKENS: usize = 5000;
/// Emphatic marks per 1,000 words of entry-file body above which emphasis has
/// stopped marking gates and become the default register.
pub const EMPHASIS_MAX_PER_1000_WORDS: f64 = 10.0;
/// The number of criteria a skill is scored on.
pub const CRITERIA: usize = 6;

/// One skill's measures. `pass_*` turns each into the criterion's verdict.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct SkillRubricRow {
    /// The skill's directory name under `.claude/skills/`.
    pub skill: String,
    pub description: DescriptionMeasure,
    pub entry: EntryMeasure,
    /// `file:line: token`, file relative to `.claude/`.
    pub dead_references: Vec<String>,
    pub emphasis: EmphasisMeasure,
    /// `file:line: token` for each harness tool name with no fallback nearby.
    pub harness_tools: Vec<String>,
    pub duplicates: DuplicateMeasure,
}

impl SkillRubricRow {
    pub fn pass_description(&self) -> bool {
        let d = &self.description;
        d.states_what
            && d.states_when
            && d.states_when_not
            && d.description_chars <= DESCRIPTION_MAX_CHARS
            && d.listing_chars <= LISTING_MAX_CHARS
    }
    pub fn pass_entry(&self) -> bool {
        self.entry.tokens <= ENTRY_MAX_TOKENS
    }
    pub fn pass_references(&self) -> bool {
        self.dead_references.is_empty()
    }
    pub fn pass_emphasis(&self) -> bool {
        self.emphasis.per_1000_words() <= EMPHASIS_MAX_PER_1000_WORDS
    }
    pub fn pass_harness_tools(&self) -> bool {
        self.harness_tools.is_empty()
    }
    pub fn pass_duplicates(&self) -> bool {
        self.duplicates.passages == 0
    }
    /// Criteria passed, out of [`CRITERIA`].
    pub fn score(&self) -> usize {
        [
            self.pass_description(),
            self.pass_entry(),
            self.pass_references(),
            self.pass_emphasis(),
            self.pass_harness_tools(),
            self.pass_duplicates(),
        ]
        .iter()
        .filter(|passed| **passed)
        .count()
    }
}

/// Dead references per skill, from the docs-reference and skill-link scans.
fn dead_references(claude_dir: &Path) -> BTreeMap<String, Vec<String>> {
    let docs = check_docs_references(claude_dir).findings;
    let links = check_skill_links(claude_dir);
    let found = docs
        .iter()
        .map(|f| (&f.file, f.line, &f.token))
        .chain(links.iter().map(|f| (&f.file, f.line, &f.token)));
    let mut out: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for (file, line, token) in found {
        if let Some(skill) = file
            .strip_prefix("skills/")
            .and_then(|r| r.split('/').next())
        {
            out.entry(skill.to_string())
                .or_default()
                .push(format!("{file}:{line}: {token}"));
        }
    }
    out
}

/// Score every skill under `<claude_dir>/skills`, sorted by name.
pub fn score_skills(claude_dir: &Path) -> Vec<SkillRubricRow> {
    let skills_root = claude_dir.join("skills");
    let names = skill_names(&skills_root);
    let mut dead = dead_references(claude_dir);
    let mut duplicates = measure_duplicates(claude_dir, &names);
    names
        .into_iter()
        .map(|skill| {
            let dir = skills_root.join(&skill);
            let entry_text = read(&dir.join("SKILL.md"));
            let mut harness_tools = Vec::new();
            for file in markdown_files(&dir) {
                let rel = file.strip_prefix(claude_dir).unwrap_or(&file);
                let rel = rel.to_string_lossy().replace('\\', "/");
                for (line, token) in unhedged_tool_names(&read(&file)) {
                    harness_tools.push(format!("{rel}:{line}: {token}"));
                }
            }
            SkillRubricRow {
                description: measure_description(&entry_text),
                entry: measure_entry(&entry_text),
                dead_references: dead.remove(&skill).unwrap_or_default(),
                emphasis: measure_emphasis(&entry_text),
                harness_tools,
                duplicates: duplicates.remove(&skill).unwrap_or_default(),
                skill,
            }
        })
        .collect()
}

/// The file's text with CRLF folded to LF, so a Windows checkout scores the same
/// as any other: sizes and token estimates must not count carriage returns.
fn read(path: &Path) -> String {
    String::from_utf8_lossy(&std::fs::read(path).unwrap_or_default()).replace("\r\n", "\n")
}

#[cfg(test)]
#[path = "skill_rubric_tests.rs"]
mod skill_rubric_tests;
