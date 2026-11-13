//! `validate --portable`: the provider-contract surface matrix.
//!
//! Honest rendering is the whole point of this check: a `warn`-severity
//! diagnostic renders WARN (an earlier version mapped it to PASS, showing green
//! over a known gap), and an `unsupported` surface renders N/A rather than
//! being silently dropped. A one-line coverage summary makes the totals
//! explicit. Port of `checkPortability`/`diagnosticToStatus` in
//! `commands/validate.ts` over `migrate/provider-contract-diagnostics.ts`.
//!
//! ## Why the matrix is a table here
//!
//! The npm diagnostics are computed from the provider MANIFESTS, which carry no
//! project state — `collectProviderContractDiagnostics()` takes no argument, so
//! its output is a constant of the CLI. Mirroring the three inputs per surface
//! (the contract status, and whether the surface is configured raw and
//! effectively) keeps the LOGIC ported rather than its conclusions: severity
//! and message are still derived here. The real-repo parity case is what holds
//! the table to the manifests.
use super::result::{CheckResult, Section, Status};

/// The surfaces a provider contract describes, in report order.
const SURFACES: [(&str, &str); 6] = [
    ("agent", "agents"),
    ("command", "commands"),
    ("skill", "skills"),
    ("config", "configs"),
    ("rules", "rules"),
    ("hooks", "hooks"),
];

/// One provider's contract: its display name, then per surface the declared
/// status and whether it is configured raw / effectively.
struct ProviderContract {
    display_name: &'static str,
    /// `(surface, status, raw_configured, effective_configured)`.
    surfaces: [(&'static str, &'static str, bool, bool); 6],
}

/// The three adapted providers. Claude Code documents every surface; Codex
/// documents skills, configs and rules and is `partial` on the rest; Cursor
/// supports configs and rules, and its agents/skills surfaces stay disabled by
/// the contract even though the raw config names them.
const PROVIDERS: [ProviderContract; 3] = [
    ProviderContract {
        display_name: "Claude Code",
        surfaces: [
            ("agent", "documented", true, true),
            ("command", "documented", true, true),
            ("skill", "documented", true, true),
            ("config", "documented", true, true),
            ("rules", "documented", true, true),
            ("hooks", "documented", true, true),
        ],
    },
    ProviderContract {
        display_name: "Codex",
        surfaces: [
            ("agent", "partial", false, false),
            ("command", "partial", false, false),
            ("skill", "documented", true, true),
            ("config", "documented", true, true),
            ("rules", "documented", true, true),
            ("hooks", "partial", false, false),
        ],
    },
    ProviderContract {
        display_name: "Cursor",
        surfaces: [
            ("agent", "partial", true, false),
            ("command", "unsupported", false, false),
            ("skill", "unsupported", true, false),
            ("config", "documented", true, true),
            ("rules", "documented", true, true),
            ("hooks", "unsupported", false, false),
        ],
    },
];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Severity {
    Pass,
    Warn,
    Fail,
}

/// A documented surface that is not configured is a WARN; an undocumented one
/// that is still enabled is a FAIL, and one the contract disabled is a PASS.
fn classify_surface(status: &str, raw: bool, effective: bool) -> Severity {
    if status == "documented" {
        return if effective {
            Severity::Pass
        } else {
            Severity::Warn
        };
    }
    if effective {
        return Severity::Fail;
    }
    if raw {
        return Severity::Warn;
    }
    Severity::Pass
}

fn diagnostic_message(
    display_name: &str,
    surface_label: &str,
    status: &str,
    raw: bool,
    effective: bool,
) -> String {
    if status == "documented" && !effective {
        return format!("{display_name}: {surface_label} surface is documented but not configured");
    }
    if status != "documented" && effective {
        return format!("{display_name}: {surface_label} surface is {status} but remains enabled");
    }
    if status != "documented" && raw {
        return format!(
            "{display_name}: {surface_label} surface is {status}; disabled by provider contract"
        );
    }
    format!("{display_name}: {surface_label} surface matches provider contract")
}

/// Map a diagnostic to an honest status: an `unsupported` SURFACE is N/A
/// whatever its severity, because "this host does not have one" is not a defect.
fn diagnostic_to_status(surface_status: &str, severity: Severity) -> Status {
    if surface_status == "unsupported" {
        return Status::Na;
    }
    match severity {
        Severity::Fail => Status::Fail,
        Severity::Warn => Status::Warn,
        Severity::Pass => Status::Pass,
    }
}

pub fn check_portability() -> Vec<CheckResult> {
    let mut results = Vec::new();
    let (mut passed, mut warned, mut na, mut failed) = (0usize, 0usize, 0usize, 0usize);
    for provider in &PROVIDERS {
        for (surface, status, raw, effective) in provider.surfaces {
            let label = SURFACES
                .iter()
                .find(|(key, _)| *key == surface)
                .map(|(_, label)| *label)
                .unwrap_or(surface);
            let severity = classify_surface(status, raw, effective);
            let row_status = diagnostic_to_status(status, severity);
            match row_status {
                Status::Na => na += 1,
                Status::Fail => failed += 1,
                Status::Warn => warned += 1,
                Status::Pass => passed += 1,
            }
            results.push(CheckResult::new(
                format!("Provider contract: {}/{surface}", provider.display_name),
                row_status,
                diagnostic_message(provider.display_name, label, status, raw, effective),
                Section::Portability,
            ));
        }
    }
    let total = results.len();
    results.push(CheckResult::new(
        "Portability coverage",
        Status::Pass,
        format!(
            "{passed} native, {na} N/A, {warned} warn, {failed} fail across {total} surface(s)."
        ),
        Section::Portability,
    ));
    results
}

#[cfg(test)]
#[path = "portability_tests.rs"]
mod portability_tests;
