//! The diff-scoped Review Impact Map: what a pull request actually touches,
//! derived from the captured diff alone.
//!
//! Every field is SOURCE-CITED — file paths and literal symbol names — rather
//! than a prose summary of the change, because the map decides whether a
//! targeted scout pass is required before reviewers fan out, and a reviewer
//! has to be able to check that decision against the diff.
//!
//! The field ORDER of the serialized map is the npm CLI's runtime insertion
//! order, not the declaration order of its TypeScript interface: `renamedFrom`
//! is assigned after a file's counters, so it serializes last.
use serde::{Deserialize, Serialize};

use super::impact_scout::{judge, push_unique, record_removed_files};
use super::patterns::{
    CONFIG_KEY_RE, CONFIG_RE, DOCS_RE, LOCKFILE_RE, RISK_PATTERNS, SOURCE_RE, TEST_RE,
    export_symbols,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum FileKind {
    #[default]
    Source,
    Test,
    Docs,
    Config,
    Lockfile,
    Other,
}

/// Every field defaults on READ for the same reason the map does: an older
/// impact map that predates a counter must still rebuild a roster, and an
/// absent counter means "nothing recorded", not "refuse the whole gate".
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ChangedFile {
    pub path: String,
    pub kind: FileKind,
    pub deleted: bool,
    pub added: u64,
    pub removed: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub renamed_from: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DiffStats {
    /// Changed lines in SOURCE files — what selects the reviewer topology.
    pub source_changed: u64,
    pub total_changed: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SymbolRef {
    pub file: String,
    pub symbol: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CallerHits {
    pub term: String,
    pub hits: Vec<String>,
}

/// Every field DEFAULTS on read: an impact map written by an older CLI (before
/// `stats` existed, say) must still yield a roster rather than refuse the whole
/// coverage gate.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ImpactMap {
    pub changed_files: Vec<ChangedFile>,
    pub changed_exports: Vec<SymbolRef>,
    /// Removed exports plus deleted/renamed files: the contract risk.
    pub removed_or_renamed: Vec<SymbolRef>,
    pub config_keys: Vec<String>,
    pub production_dirs: Vec<String>,
    pub risk_flags: Vec<String>,
    pub search_terms: Vec<String>,
    pub scout_required: bool,
    pub scout_reasons: Vec<String>,
    #[serde(default)]
    pub stats: DiffStats,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub callers: Option<Vec<CallerHits>>,
}

fn classify(path: &str) -> FileKind {
    if TEST_RE.is_match(path) {
        FileKind::Test
    } else if LOCKFILE_RE.is_match(path) {
        FileKind::Lockfile
    } else if DOCS_RE.is_match(path) {
        FileKind::Docs
    } else if SOURCE_RE.is_match(path) {
        FileKind::Source
    } else if CONFIG_RE.is_match(path) {
        FileKind::Config
    } else {
        FileKind::Other
    }
}

/// Parse a unified diff. No repository access, so the same diff always yields
/// the same map — which is what lets coverage rebuild the roster later instead
/// of trusting a persisted one.
pub fn derive_impact_from_diff(diff_text: &str) -> ImpactMap {
    let mut files: Vec<ChangedFile> = Vec::new();
    let mut changed_exports: Vec<SymbolRef> = Vec::new();
    let mut removed_or_renamed: Vec<SymbolRef> = Vec::new();
    let mut config_keys: Vec<String> = Vec::new();
    let mut risk_flags: Vec<String> = Vec::new();

    for line in diff_text.split('\n') {
        if let Some(header) = super::patterns::DIFF_HEADER_RE.captures(line) {
            files.push(ChangedFile {
                path: header[2].to_string(),
                kind: classify(&header[2]),
                deleted: false,
                added: 0,
                removed: 0,
                renamed_from: None,
            });
            continue;
        }
        let Some(cur) = files.last_mut() else {
            continue;
        };
        if line.starts_with("deleted file mode") {
            cur.deleted = true;
        }
        // `^rename from (.+)$` needs at least one character, so a header with
        // an empty source path is not a rename.
        if let Some(rename) = line.strip_prefix("rename from ").filter(|r| !r.is_empty()) {
            cur.renamed_from = Some(rename.to_string());
        }

        let added = line.starts_with('+') && !line.starts_with("+++");
        let removed = line.starts_with('-') && !line.starts_with("---");
        if !added && !removed {
            continue;
        }
        if added {
            cur.added += 1;
        } else {
            cur.removed += 1;
        }
        let content = &line[1..];

        for (flag, pattern) in RISK_PATTERNS.iter() {
            if pattern.is_match(content) || pattern.is_match(&cur.path) {
                push_unique(&mut risk_flags, flag);
            }
        }
        if cur.kind == FileKind::Source {
            for symbol in export_symbols(content) {
                let reference = SymbolRef {
                    file: cur.path.clone(),
                    symbol,
                };
                if added {
                    changed_exports.push(reference);
                } else {
                    removed_or_renamed.push(reference);
                }
            }
        }
        if cur.kind == FileKind::Config
            && added
            && let Some(key) = CONFIG_KEY_RE.captures(content)
        {
            push_unique(&mut config_keys, &key[1]);
        }
    }

    // Counted BEFORE the file pass appends to the same list: these are the
    // removed EXPORTS, and the pass adds the removed source FILES to the tally.
    let removed_exports = removed_or_renamed.len();
    let source_removals = removed_exports + record_removed_files(&files, &mut removed_or_renamed);
    let judged = judge(
        &files,
        &changed_exports,
        &removed_or_renamed,
        source_removals,
        &mut risk_flags,
    );
    risk_flags.sort();
    config_keys.sort();

    ImpactMap {
        changed_files: files,
        changed_exports,
        removed_or_renamed,
        config_keys,
        production_dirs: judged.production_dirs,
        risk_flags,
        search_terms: judged.search_terms,
        scout_required: judged.scout_required,
        scout_reasons: judged.scout_reasons,
        stats: judged.stats,
        callers: None,
    }
}

/// Attach caller/consumer citations from an injected search, so discovery is
/// testable without a worktree.
pub fn enrich_with_searches(map: ImpactMap, search: impl Fn(&str) -> Vec<String>) -> ImpactMap {
    let callers = map
        .search_terms
        .iter()
        .map(|term| CallerHits {
            term: term.clone(),
            hits: search(term),
        })
        .collect();
    ImpactMap {
        callers: Some(callers),
        ..map
    }
}

#[cfg(test)]
#[path = "impact_map_tests.rs"]
mod tests;
