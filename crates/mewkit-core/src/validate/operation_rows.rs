//! Operation-level conformance and the generic-core baseline, as rows.
//!
//! Three properties, all cheap and all load-bearing: no logical operation
//! leaked into the frontmatter-reachable invocation enum (that enum's entire
//! value is what it excludes, so erosion is silent and fatal); no unresolved
//! pseudo-capability alias in the canonical tree; and every operation an
//! installed skill references resolves on each advertised provider. Port of
//! `checkOperationConformance` and `checkGenericCoreTokens` in
//! `commands/validate.ts`.
use std::path::Path;

use super::generic_tokens::{find_generic_core_tokens, summarize_generic_core_tokens};
use super::operations::{
    assert_operations_not_invocable, find_operation_conformance, is_blocking_gap,
    summarize_operation_conformance,
};
use super::pseudo_capabilities::find_pseudo_capabilities;
use super::result::{CheckResult, Section, Status};

pub fn check_operation_conformance(claude_dir: &Path) -> Vec<CheckResult> {
    let mut results = Vec::new();

    let leaks = assert_operations_not_invocable();
    results.push(CheckResult::new(
        "Logical operations stay out of the invocation enum",
        if leaks.is_empty() {
            Status::Pass
        } else {
            Status::Fail
        },
        if leaks.is_empty() {
            "run_shell / delegate_agent / ask_user / manage_plan are not frontmatter-reachable"
                .to_string()
        } else {
            leaks.join("\n         ")
        },
        Section::Portability,
    ));

    let pseudo = find_pseudo_capabilities(claude_dir);
    results.push(CheckResult::new(
        "No unresolved pseudo-capability aliases",
        if pseudo.is_empty() {
            Status::Pass
        } else {
            Status::Fail
        },
        if pseudo.is_empty() {
            "0 unsubstituted operation placeholders in prose".to_string()
        } else {
            pseudo
                .iter()
                .map(|finding| format!("{}:{} \"{}\"", finding.file, finding.line, finding.found))
                .collect::<Vec<_>>()
                .join("\n         ")
        },
        Section::Portability,
    ));

    // A disclosed local fallback is fine; an `unsupported`/`unknown` combo is a
    // real cross-harness gap and must be surfaced, not silently advertised.
    let conformance = find_operation_conformance(claude_dir);
    let blocking: Vec<_> = conformance
        .iter()
        .filter(|finding| is_blocking_gap(finding))
        .collect();
    let example = blocking
        .iter()
        .take(5)
        .map(|finding| {
            format!(
                "{}: {} is {} on {}",
                finding.skill,
                finding.operation,
                finding.support.as_str(),
                finding.provider
            )
        })
        .collect::<Vec<_>>()
        .join("\n         ");
    results.push(CheckResult::new(
        "Installed-skill operations resolve on every advertised provider",
        if blocking.is_empty() {
            Status::Pass
        } else {
            Status::Warn
        },
        if conformance.is_empty() {
            "every operation referenced by an installed skill is supported on all advertised providers"
                .to_string()
        } else {
            format!(
                "{} non-supported combo(s) [{}]; {} are unsupported/unknown (rest are disclosed local-fallbacks){}",
                conformance.len(),
                summarize_operation_conformance(&conformance),
                blocking.len(),
                if blocking.is_empty() {
                    String::new()
                } else {
                    format!(":\n         {example}")
                }
            )
        },
        Section::Portability,
    ));

    results
}

/// The advisory baseline while skill bodies migrate to semantic prose.
pub fn check_generic_core_tokens(claude_dir: &Path) -> CheckResult {
    let findings = find_generic_core_tokens(claude_dir);
    let locations = findings
        .iter()
        .take(8)
        .map(|finding| format!("{}:{} \"{}\"", finding.file, finding.line, finding.token))
        .collect::<Vec<_>>()
        .join("\n         ");
    CheckResult::new(
        "Generic-core provider token baseline",
        if findings.is_empty() {
            Status::Pass
        } else {
            Status::Warn
        },
        if findings.is_empty() {
            "0 provider-specific body tokens".to_string()
        } else {
            format!(
                "{} finding(s); {}.\n         {locations}",
                findings.len(),
                summarize_generic_core_tokens(&findings)
            )
        },
        Section::Portability,
    )
}
