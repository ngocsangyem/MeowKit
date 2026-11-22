//! Passages copied word for word between skills.
//!
//! A paragraph is a blank-line-separated block of a skill's markdown, compared
//! after folding whitespace. One of at least [`DUPLICATE_MIN_WORDS`] words that
//! also appears in another skill is a duplicate: two copies that will drift.
//! Files the shared-family manifest names are skipped — those copies are kept
//! identical on purpose and checked by the family rows instead.
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::Path;

use super::shared_families::family_paths;

/// Shorter paragraphs (headings, one-line steps) repeat by coincidence.
pub const DUPLICATE_MIN_WORDS: usize = 40;

/// Directories inside a skill that hold sample data, not instructions.
const SKIPPED_DIRS: [&str; 7] = [
    "eval",
    "evals",
    "fixtures",
    "node_modules",
    ".venv",
    "__pycache__",
    "__tests__",
];

/// One skill's duplicated paragraphs and the skills that hold the other copies.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct DuplicateMeasure {
    pub passages: usize,
    pub shared_with: Vec<String>,
}

fn markdown_under(dir: &Path, out: &mut Vec<std::path::PathBuf>) {
    for entry in super::dir_order::sorted_entries(dir) {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        if path.is_dir() {
            if !SKIPPED_DIRS.contains(&name.as_str()) {
                markdown_under(&path, out);
            }
        } else if name.ends_with(".md") {
            out.push(path);
        }
    }
}

/// Every markdown file in one skill, sample-data directories left out.
pub fn markdown_files(skill_dir: &Path) -> Vec<std::path::PathBuf> {
    let mut out = Vec::new();
    markdown_under(skill_dir, &mut out);
    out
}

/// The long paragraphs of one text, whitespace folded.
pub fn long_paragraphs(text: &str) -> BTreeSet<String> {
    text.replace("\r\n", "\n")
        .split("\n\n")
        .map(|block| block.split_whitespace().collect::<Vec<_>>())
        .filter(|words| words.len() >= DUPLICATE_MIN_WORDS)
        .map(|words| words.join(" "))
        .collect()
}

/// Duplicated paragraphs for each named skill under `<claude_dir>/skills`.
pub fn measure_duplicates(
    claude_dir: &Path,
    skills: &[String],
) -> BTreeMap<String, DuplicateMeasure> {
    let exempt: BTreeSet<String> = family_paths(claude_dir).into_iter().collect();
    let mut holders: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    let mut per_skill: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    for skill in skills {
        let files = markdown_files(&claude_dir.join("skills").join(skill));
        let mut mine = BTreeSet::new();
        for file in files {
            let rel = file
                .strip_prefix(claude_dir)
                .unwrap_or(&file)
                .to_string_lossy()
                .replace('\\', "/");
            if exempt.contains(&rel) {
                continue;
            }
            let text = String::from_utf8_lossy(&fs::read(&file).unwrap_or_default()).into_owned();
            mine.extend(long_paragraphs(&text));
        }
        for paragraph in &mine {
            holders
                .entry(paragraph.clone())
                .or_default()
                .insert(skill.clone());
        }
        per_skill.insert(skill.clone(), mine);
    }
    per_skill
        .into_iter()
        .map(|(skill, paragraphs)| {
            let mut shared_with = BTreeSet::new();
            let mut passages = 0;
            for paragraph in &paragraphs {
                let others: Vec<&String> = holders[paragraph]
                    .iter()
                    .filter(|other| **other != skill)
                    .collect();
                if !others.is_empty() {
                    passages += 1;
                    shared_with.extend(others.into_iter().cloned());
                }
            }
            let measure = DuplicateMeasure {
                passages,
                shared_with: shared_with.into_iter().collect(),
            };
            (skill, measure)
        })
        .collect()
}
