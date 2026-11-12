//! `mewkit validate --memory` — lint the committed team-memory store.
//!
//! Port of `core/check-memory-store.ts`. v3 memory is plain markdown under
//! `.meowkit/memory/`, committed and reviewed in the PR diff. There is no index,
//! no schema and no approve gate, so this lint plus the PR diff are the guard. It
//! enforces four properties, all load-bearing:
//!
//! 1. SIZE — a file over [`MEMORY_FILE_MAX_LINES`] lines, or over the byte cap,
//!    has stopped being a recall surface and become a dump; the read path (one
//!    grep) degrades and the PR diff stops being reviewable.
//! 2. INJECTION — memory is DATA. Instruction-like text in a file that read-set
//!    skills open is a stored prompt-injection vector, scanned through every
//!    decode pass `injection-rules.md` Rule 8 names, not just plaintext.
//! 3. SECRETS — security findings and credentials never belong in a shared,
//!    committed recall file. Scanned per line AND whole-body, because a PEM block
//!    spans lines.
//! 4. SCANNABILITY — the documented read is `grep -ril … .meowkit/memory/`, which
//!    is recursive and not extension-filtered. So the lint walks the same surface,
//!    and any path it CANNOT read is a FAIL finding, never an affirmative "clean"
//!    verdict.
//!
//! A missing directory or an empty store is a PASS: there is nothing to lint, and
//! a project that has never recorded a lesson is healthy, not broken.
use std::path::Path;

use crate::state_paths::{StateClass, resolve_state_dir};

use super::content_scan::{count_lines, scan_memory_content_capped};
use super::errno::errno_of;
use super::finding::MemoryFindingKind;
use super::obfuscation_passes::MAX_CONTENT_BYTES;
use super::walk_store::{ReadForScan, read_for_scan, walk_store};

/// A memory file longer than this has stopped being a recall surface.
pub const MEMORY_FILE_MAX_LINES: usize = 300;
/// Per-file byte ceiling: a 3-line file of any byte size used to pass the line cap.
pub const MEMORY_FILE_MAX_BYTES: usize = MAX_CONTENT_BYTES;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MemoryFinding {
    /// Project-relative path of the offending file.
    pub file: String,
    /// 1-based line number; 0 when the finding is about the file as a whole.
    pub line: usize,
    pub kind: MemoryFindingKind,
    pub detail: String,
}

pub(super) fn relative(project_root: &Path, path: &Path) -> String {
    path.strip_prefix(project_root)
        .unwrap_or(path)
        .display()
        .to_string()
}

/// Scan every file in the project's memory store. One finding per problem; an
/// empty vector means the store is clean (or absent).
pub fn find_memory_store_findings(project_root: &Path) -> Vec<MemoryFinding> {
    let memory_dir = resolve_state_dir(project_root, StateClass::Memory);
    if !memory_dir.exists() {
        return Vec::new();
    }

    // The store MUST be a directory. A botched `>` redirect turns it into a file,
    // which a `read_dir` + "treat the error as empty" path would report as an
    // affirmatively clean store.
    let metadata = match std::fs::metadata(&memory_dir) {
        Ok(metadata) => metadata,
        Err(error) => {
            return vec![MemoryFinding {
                file: relative(project_root, &memory_dir),
                line: 0,
                kind: MemoryFindingKind::Unreadable,
                detail: format!("store could not be stat'd ({})", errno_of(&error)),
            }];
        }
    };
    if !metadata.is_dir() {
        return vec![MemoryFinding {
            file: relative(project_root, &memory_dir),
            line: 0,
            kind: MemoryFindingKind::Unreadable,
            detail:
                "the memory store path is not a directory — the write path is broken and nothing was scanned"
                    .to_string(),
        }];
    }

    let walked = walk_store(&memory_dir);
    let mut findings: Vec<MemoryFinding> = walked
        .unreadable
        .into_iter()
        .map(|entry| MemoryFinding {
            file: relative(project_root, &entry.path),
            line: 0,
            kind: MemoryFindingKind::Unreadable,
            detail: entry.detail,
        })
        .collect();

    for full_path in walked.files {
        let file = relative(project_root, &full_path);
        let body = match read_for_scan(&full_path, MEMORY_FILE_MAX_BYTES as u64) {
            ReadForScan::Finding(finding) => {
                findings.push(MemoryFinding {
                    file,
                    line: finding.line,
                    kind: finding.kind,
                    detail: finding.detail,
                });
                continue;
            }
            ReadForScan::Body(body) => body,
        };

        let line_count = count_lines(&body);
        if line_count > MEMORY_FILE_MAX_LINES {
            findings.push(MemoryFinding {
                file: file.clone(),
                line: 0,
                kind: MemoryFindingKind::Size,
                detail: format!(
                    "{line_count} lines exceeds the {MEMORY_FILE_MAX_LINES}-line cap — prune or split the store"
                ),
            });
        }

        for finding in scan_memory_content_capped(&body, MEMORY_FILE_MAX_BYTES) {
            findings.push(MemoryFinding {
                file: file.clone(),
                line: finding.line,
                kind: finding.kind,
                detail: finding.detail,
            });
        }
    }
    findings
}
