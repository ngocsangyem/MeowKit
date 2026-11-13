//! Judging a parsed diff: contract risk, risk flags, and whether a targeted
//! scout pass is REQUIRED before reviewers fan out.
//!
//! Kept apart from the parser because this is the opinionated half. Every rule
//! below answers "what could this change break that the diff alone does not
//! show", and each one has to state its reason in `scoutReasons` — a required
//! scout with no citation is a verdict nobody can check.
use super::impact_map::{ChangedFile, DiffStats, FileKind, SymbolRef};
use super::patterns::{ABSTRACTION_PATH_RE, IDENTIFIER_RE};

/// What the judging pass adds to the parsed diff.
pub struct Judgement {
    pub production_dirs: Vec<String>,
    pub search_terms: Vec<String>,
    pub scout_required: bool,
    pub scout_reasons: Vec<String>,
    pub stats: DiffStats,
}

/// Insertion-ordered set: the npm CLI uses a `Set`, whose iteration order is
/// insertion order, and these lists are read by a human.
pub fn push_unique(into: &mut Vec<String>, value: &str) {
    if !into.iter().any(|v| v == value) {
        into.push(value.to_string());
    }
}

/// The first two path segments, or `.` for a file at the root.
fn top_dir(path: &str) -> String {
    let parts: Vec<&str> = path.split('/').collect();
    if parts.len() > 1 {
        parts[..2].join("/")
    } else {
        ".".to_string()
    }
}

/// A deleted or renamed file is a contract change in its own right. Only test,
/// docs and lockfile churn is ignorable: a dropped config or schema file
/// breaks consumers exactly as a dropped export does.
///
/// Returns how many SOURCE files were removed, which feeds `PUBLIC_API`.
pub fn record_removed_files(files: &[ChangedFile], into: &mut Vec<SymbolRef>) -> usize {
    let mut source_removals = 0;
    for file in files {
        if !file.deleted && file.renamed_from.is_none() {
            continue;
        }
        if matches!(
            file.kind,
            FileKind::Test | FileKind::Docs | FileKind::Lockfile
        ) {
            continue;
        }
        if file.deleted {
            into.push(SymbolRef {
                file: file.path.clone(),
                symbol: if file.kind == FileKind::Source {
                    "<file deleted>".into()
                } else {
                    "<config/file deleted>".into()
                },
            });
        }
        if let Some(from) = &file.renamed_from {
            into.push(SymbolRef {
                file: from.clone(),
                symbol: format!("<renamed → {}>", file.path),
            });
        }
        if file.kind == FileKind::Source {
            source_removals += 1;
        }
    }
    source_removals
}

pub fn judge(
    files: &[ChangedFile],
    changed_exports: &[SymbolRef],
    removed_or_renamed: &[SymbolRef],
    source_removals: usize,
    risk_flags: &mut Vec<String>,
) -> Judgement {
    let source_files: Vec<&ChangedFile> = files
        .iter()
        .filter(|f| f.kind == FileKind::Source)
        .collect();
    let mut production_dirs: Vec<String> = Vec::new();
    for file in &source_files {
        push_unique(&mut production_dirs, &top_dir(&file.path));
    }
    production_dirs.sort();
    if !changed_exports.is_empty() || source_removals > 0 {
        push_unique(risk_flags, "PUBLIC_API");
    }
    if source_files
        .iter()
        .any(|f| !f.deleted && ABSTRACTION_PATH_RE.is_match(&f.path))
    {
        push_unique(risk_flags, "ABSTRACTION");
    }

    let mut search_terms: Vec<String> = Vec::new();
    for reference in changed_exports.iter().chain(removed_or_renamed.iter()) {
        if IDENTIFIER_RE.is_match(&reference.symbol) {
            push_unique(&mut search_terms, &reference.symbol);
        }
    }

    let mut scout_reasons: Vec<String> = Vec::new();
    if !removed_or_renamed.is_empty() {
        scout_reasons.push("public symbol / file / config removed or renamed".into());
    }
    for flag in ["AUTH", "PAYMENT", "DATA_MODEL", "CONCURRENCY"] {
        if risk_flags.iter().any(|f| f == flag) {
            scout_reasons.push(format!("touches {flag}"));
        }
    }
    if production_dirs.len() >= 3 {
        scout_reasons.push(format!(
            "spans {} production directories",
            production_dirs.len()
        ));
    }
    if source_files.len() >= 5 {
        scout_reasons.push(format!("{} source files changed", source_files.len()));
    }
    if risk_flags.iter().any(|f| f == "ABSTRACTION") {
        scout_reasons.push("introduces a utility/abstraction (prior-art search)".into());
    }

    // An EMPTY file list satisfies `every` vacuously, so a diff that parsed to
    // nothing never requires a scout — the npm CLI's behaviour, kept.
    let non_source = files
        .iter()
        .all(|f| matches!(f.kind, FileKind::Docs | FileKind::Lockfile | FileKind::Test));
    Judgement {
        production_dirs,
        search_terms,
        scout_required: !non_source && !scout_reasons.is_empty(),
        scout_reasons,
        stats: DiffStats {
            source_changed: source_files.iter().map(|f| f.added + f.removed).sum(),
            total_changed: files.iter().map(|f| f.added + f.removed).sum(),
        },
    }
}
