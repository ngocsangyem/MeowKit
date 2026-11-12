//! How `validate` renders the memory lint: the row type and the projection from
//! findings to rows.
//!
//! Split from the lint itself (`check_store.rs`) because the two answer different
//! questions — "what is wrong with the store" versus "what does `validate` print".
//! A clean or absent store is ONE pass row; every finding is its own fail row.
use std::path::Path;

use crate::state_paths::{StateClass, resolve_state_dir};

use super::check_store::{MEMORY_FILE_MAX_LINES, find_memory_store_findings, relative};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CheckStatus {
    Pass,
    Fail,
}

impl CheckStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            CheckStatus::Pass => "pass",
            CheckStatus::Fail => "fail",
        }
    }
}

/// One row of `validate` output. The TS `CheckResult` shape, with `section` fixed
/// to `Memory` for every row this lint emits.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MemoryCheckResult {
    pub name: String,
    pub status: CheckStatus,
    pub detail: String,
    pub section: &'static str,
}

const SECTION: &str = "Memory";

/// `validate --memory` as check results. A clean or absent store reports a single
/// PASS.
pub fn check_memory_store(project_root: &Path) -> Vec<MemoryCheckResult> {
    let memory_dir = resolve_state_dir(project_root, StateClass::Memory);
    let relative_dir = relative(project_root, &memory_dir);
    let pass = |detail: String| {
        vec![MemoryCheckResult {
            name: "Team memory store lint".to_string(),
            status: CheckStatus::Pass,
            detail,
            section: SECTION,
        }]
    };

    if !memory_dir.exists() {
        return pass(format!(
            "No memory store yet ({relative_dir}) — created on the first memory write."
        ));
    }

    let findings = find_memory_store_findings(project_root);
    if findings.is_empty() {
        return pass(format!(
            "Store under {relative_dir} is within the {MEMORY_FILE_MAX_LINES}-line cap, injection-free and secret-free."
        ));
    }

    findings
        .into_iter()
        .map(|finding| {
            let suffix = if finding.line > 0 {
                format!(":{}", finding.line)
            } else {
                String::new()
            };
            MemoryCheckResult {
                name: format!("Memory {}: {}{suffix}", finding.kind, finding.file),
                status: CheckStatus::Fail,
                detail: finding.detail,
                section: SECTION,
            }
        })
        .collect()
}
