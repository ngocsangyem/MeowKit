//! The docs-reference scan as `validate` rows.
//!
//! Separate from the scan itself because the two answer different questions:
//! "which references do not resolve" versus "what does `validate` print". An
//! error count fails the section, a warn count warns, and an absent contract
//! is N/A rendered as a PASS row with an `N/A —` detail — which is what the npm
//! CLI does, and a consumer install must not fail for lacking a maintainer doc.
use std::path::Path;

use super::docs_refs::{RefLevel, check_docs_references};
use super::docs_refs_tokens::resolve_contract_path;
use super::result::{CheckResult, Section, Status};

const NAME: &str = "Docs references on Type-1 allowlist";

pub fn check_docs_refs_contract(claude_dir: &Path) -> Vec<CheckResult> {
    let result = check_docs_references(claude_dir);
    if result.not_applicable {
        return vec![CheckResult::new(
            NAME,
            Status::Pass,
            format!(
                "N/A — maintainer contract absent ({})",
                resolve_contract_path(claude_dir).display()
            ),
            Section::Docs,
        )];
    }

    let summary = format!(
        "Scanned {} files — {} error(s), {} warning(s)",
        result.scanned_files, result.error_count, result.warn_count
    );
    let status = if result.error_count > 0 {
        Status::Fail
    } else if result.warn_count > 0 {
        Status::Warn
    } else {
        Status::Pass
    };
    let detail = if result.error_count == 0 {
        summary
    } else {
        // Only the first ten errors are listed: the summary carries the count,
        // and a thousand-line detail block is not read by anyone.
        let listed: Vec<String> = result
            .findings
            .iter()
            .filter(|f| f.level == RefLevel::Error)
            .take(10)
            .map(|f| format!("{}:{}: {}", f.file, f.line, f.token))
            .collect();
        format!("{summary}\n         {}", listed.join("\n         "))
    };
    vec![CheckResult::new(NAME, status, detail, Section::Docs)]
}
