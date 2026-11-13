//! Does every `docs/…` path a kit file names actually SHIP?
//!
//! A reference to a maintainer-only doc resolves in the source checkout and
//! breaks in a consumer project, where that file was never installed. The
//! maintainer contract carries the allowlist; this scans the shipped `.claude/`
//! subtrees against it. Port of `core/check-docs-references.ts` plus
//! `core/docs-reference-contract-paths.ts`.
//!
//! The contract itself is NOT shipped, so its absence makes the check N/A — a
//! consumer has no allowlist to check against, and failing there would fail
//! every consumer install.
use std::fs;
use std::path::{Path, PathBuf};

use super::docs_refs_tokens::{extract_tokens, is_allowed, parse_allowlist, resolve_contract_path};

/// Subdirectories under `.claude/` that ship in the release archive.
const SCAN_DIRS: [&str; 9] = [
    "agents",
    "skills",
    "commands",
    "memory",
    "hooks",
    "scripts",
    "rules",
    "modes",
    "benchmarks",
];

/// Files allowed to mention banned paths, because they DEFINE the bans.
const FILE_WHITELIST: [&str; 1] = ["skills/skill-creator/references/skill-authoring-rules.md"];

/// Skill dirs whose Grep-of-a-user-project semantics need an opt-out.
const SKILL_DIR_WHITELIST: [&str; 1] = ["skills/docs-finder"];

const SCANNED_EXTENSIONS: [&str; 5] = ["md", "sh", "py", "cjs", "js"];

/// Directories that are never scanned: dependency trees, and test fixtures —
/// a `docs/` path inside a test file is fixture data that nothing resolves.
const SKIPPED_DIRS: [&str; 5] = ["node_modules", ".venv", "tests", "__tests__", "__pycache__"];

pub const CONTRACT_REL_PATH: &str = "docs/maintainer/docs-reference-contract.md";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RefLevel {
    Error,
    Warn,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DocsRefFinding {
    /// Path relative to the scanned `.claude/` directory.
    pub file: String,
    pub line: usize,
    pub token: String,
    pub level: RefLevel,
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct DocsRefResult {
    pub scanned_files: usize,
    pub findings: Vec<DocsRefFinding>,
    pub error_count: usize,
    pub warn_count: usize,
    /// True when the maintainer contract is absent, so there was no allowlist.
    pub not_applicable: bool,
}

fn walk_scanned(dir: &Path, out: &mut Vec<PathBuf>) {
    for entry in super::dir_order::sorted_entries(dir) {
        let name = entry.file_name().to_string_lossy().into_owned();
        let path = entry.path();
        if path.is_dir() {
            if SKIPPED_DIRS.contains(&name.as_str()) {
                continue;
            }
            walk_scanned(&path, out);
        } else if path.is_file()
            && SCANNED_EXTENSIONS
                .iter()
                .any(|ext| name.ends_with(&format!(".{ext}")))
        {
            out.push(path);
        }
    }
}

/// Scan the shipped subtrees of one `.claude/` directory against the contract.
pub fn check_docs_references(claude_dir: &Path) -> DocsRefResult {
    let contract = resolve_contract_path(claude_dir);
    if !contract.exists() {
        return DocsRefResult {
            not_applicable: true,
            ..DocsRefResult::default()
        };
    }
    let (allowed, reserved) = parse_allowlist(&contract);
    let mut result = DocsRefResult::default();

    for sub in SCAN_DIRS {
        let mut files = Vec::new();
        walk_scanned(&claude_dir.join(sub), &mut files);
        for file in files {
            result.scanned_files += 1;
            let rel = file
                .strip_prefix(claude_dir)
                .unwrap_or(&file)
                .to_string_lossy()
                .replace('\\', "/");
            if FILE_WHITELIST.contains(&rel.as_str()) {
                continue;
            }
            if SKILL_DIR_WHITELIST
                .iter()
                .any(|prefix| rel.starts_with(&format!("{prefix}/")))
            {
                continue;
            }
            // Lossy: Node's UTF-8 read substitutes replacement characters and
            // scans the line anyway, so a file with one bad byte is still
            // checked rather than silently skipped.
            let content =
                String::from_utf8_lossy(&fs::read(&file).unwrap_or_default()).into_owned();
            for (index, line) in content.split('\n').enumerate() {
                for token in extract_tokens(line) {
                    if is_allowed(&token, &allowed) {
                        continue;
                    }
                    let level = if is_allowed(&token, &reserved) {
                        RefLevel::Warn
                    } else {
                        RefLevel::Error
                    };
                    result.findings.push(DocsRefFinding {
                        file: rel.clone(),
                        line: index + 1,
                        token,
                        level,
                    });
                }
            }
        }
    }

    result.error_count = result
        .findings
        .iter()
        .filter(|f| f.level == RefLevel::Error)
        .count();
    result.warn_count = result.findings.len() - result.error_count;
    result
}

#[cfg(test)]
#[path = "docs_refs_tests.rs"]
mod docs_refs_tests;
