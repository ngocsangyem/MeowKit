//! Rows in, the printed report and the exit code out.
//!
//! The npm CLI prints as it goes and calls `process.exit` at the end; this
//! returns the bytes and the code instead, so the whole report is testable
//! without a process and the CLI keeps the only `exit`.
//!
//! No colour is emitted. `picocolors` disables itself when stdout is not a TTY,
//! which is how every machine consumer — CI, the pre-ship hook — already reads
//! this output, so plain text IS the contract those consumers parse.
use super::result::{CheckResult, Status};

/// The report body: each non-empty section, then the one-line summary.
pub fn render_results(results: &[CheckResult]) -> String {
    let mut out = String::new();
    for section in super::Section::ORDER {
        let rows: Vec<&CheckResult> = results.iter().filter(|r| r.section == section).collect();
        if rows.is_empty() {
            continue;
        }
        out.push_str(section.heading());
        out.push('\n');
        for row in rows {
            out.push_str(&format!("  [{}] {}\n", row.status.label(), row.name));
            // A PASS row's detail is suppressed: it is the path or the count
            // that made it pass, and printing it for every row buries the rows
            // that need reading.
            if row.status != Status::Pass {
                out.push_str(&format!("         {}\n", row.detail));
            }
        }
        out.push('\n');
    }
    out.push_str(&summary(results));
    out.push('\n');
    out
}

fn count(results: &[CheckResult], status: Status) -> usize {
    results.iter().filter(|r| r.status == status).count()
}

/// `3 passed, 1 warnings, 2 n/a` — the npm CLI's wording, plural "warnings"
/// included, and a zero-count part omitted entirely.
fn summary(results: &[CheckResult]) -> String {
    let warn = count(results, Status::Warn);
    let na = count(results, Status::Na);
    let fail = count(results, Status::Fail);
    let mut parts = vec![format!("{} passed", count(results, Status::Pass))];
    if warn > 0 {
        parts.push(format!("{warn} warnings"));
    }
    if na > 0 {
        parts.push(format!("{na} n/a"));
    }
    if fail > 0 {
        parts.push(format!("{fail} failed"));
    }
    parts.join(", ")
}

/// Exit 1 on any FAIL; a WARN fails only under `--strict`. N/A never fails:
/// "this does not apply here" is not a defect.
pub fn exit_code(results: &[CheckResult], strict: bool) -> u8 {
    let failed = count(results, Status::Fail) > 0;
    let warned = strict && count(results, Status::Warn) > 0;
    u8::from(failed || warned)
}

#[cfg(test)]
#[path = "render_tests.rs"]
mod render_tests;
