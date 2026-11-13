//! `verdict-gate` against both CLIs, and against the Gate 2 hook's parser.
//!
//! Every outcome of the check is a case: pass, pass-with-risk, blocked, a
//! schema refusal (zod's wording, word for word), unparseable JSON, a
//! directory where the file should be, a missing verdict, the usage error, and
//! a markdown-only verdict.
//!
//! The last test runs `.claude/hooks/lib/validate-gate-2.cjs` on the markdown
//! verdicts. Where a JSON verdict and its markdown sibling both exist, the two
//! checks agree. A markdown-ONLY verdict carrying a FAIL row is the one known
//! disagreement: `verdict-gate` tolerates it (both CLIs), the hook blocks it.
//! The test pins that gap so closing it is a visible, separate change.
use std::process::Command;

use crate::parity;

const FIXTURE: &str = "verdict-gate";

fn gate(name: &'static str, args: &[&str]) -> Option<(parity::Run, parity::Run)> {
    let mut argv = vec!["verdict-gate"];
    argv.extend_from_slice(args);
    parity::case(name).fixture(FIXTURE).args(&argv).run()
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_pass_verdict_passes() {
    let Some((ts, _)) = gate("verdict-gate-pass", &["pass"]) else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(ts.stdout.contains("PASS — ship may proceed."));
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_pass_with_risk_verdict_passes_by_explicit_path() {
    let Some((ts, _)) = gate(
        "verdict-gate-risk-path",
        &["tasks/reviews/risk-verdict.json"],
    ) else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(ts.stdout.contains("PASS_WITH_RISK"));
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_blocked_verdict_blocks_through_its_markdown_name() {
    let Some((ts, _)) = gate(
        "verdict-gate-blocked-md",
        &["tasks/reviews/blocked-verdict.md"],
    ) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(ts.stderr.contains("blocked (blocked)"));
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_schema_violation_lists_every_zod_issue() {
    let Some((ts, _)) = gate("verdict-gate-shape", &["shape"]) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("dimensions.1.verdict: Invalid enum value.")
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn unparseable_json_is_invalid() {
    let Some((ts, _)) = parity::case("verdict-gate-broken-json")
        .fixture(FIXTURE)
        .args(&["verdict-gate", "broken"])
        // V8's JSON.parse wording and serde_json's cannot be made to agree;
        // the status line and the `invalid JSON:` prefix still must.
        .redact(
            r"invalid JSON: [^\n]*",
            "invalid JSON: <parser message>",
            "JSON parser error wording differs between V8 and serde_json",
        )
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(ts.stderr.contains("blocked (invalid)"));
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_directory_in_place_of_the_verdict_is_invalid() {
    gate("verdict-gate-directory", &["dir"]);
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_missing_verdict_is_refused_with_its_normalised_path() {
    let Some((ts, _)) = gate("verdict-gate-missing", &["x/../nothing"]) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(ts.stderr.contains("blocked (missing)"));
}

#[test]
#[ignore = "needs node and the TS build"]
fn no_target_is_a_usage_error_and_extra_arguments_are_ignored() {
    let Some((ts, _)) = gate("verdict-gate-usage", &[]) else {
        return;
    };
    assert_eq!(ts.code, 2, "{}", ts.describe());
    gate("verdict-gate-extra-args", &["pass", "ignored", "--json"]);
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_markdown_only_verdict_is_tolerated() {
    let Some((ts, _)) = gate("verdict-gate-legacy-md", &["legacy"]) else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(ts.stdout.contains("markdown-only verdict tolerated"));
}

/// `validate-gate-2.cjs` on one markdown verdict: true when it blocks.
fn hook_blocks(md: &std::path::Path) -> bool {
    let hook = parity::repo_root()
        .join(".claude")
        .join("hooks")
        .join("lib")
        .join("validate-gate-2.cjs");
    let script = "const {validateGate2}=require(process.argv[1]);\
                  process.exit(validateGate2({input:process.argv[2]}).exit)";
    let status = Command::new("node")
        .args(["-e", script])
        .arg(&hook)
        .arg(md)
        .status()
        .expect("run node");
    status.code() == Some(1)
}

#[test]
#[ignore = "needs node and the TS build"]
fn the_hook_and_verdict_gate_agree_except_on_a_markdown_only_fail() {
    let Some(_) = parity::check("verdict-gate-hook-agreement") else {
        return;
    };
    let reviews = parity::repo_root()
        .join("crates/mewkit-cli/tests/parity/fixtures")
        .join(FIXTURE)
        .join("tasks")
        .join("reviews");
    let gate_blocks = |slug: &str| {
        let path = reviews.join(format!("{slug}-verdict.json"));
        !mewkit_core::verdict_gate::evaluate(&path.to_string_lossy()).ok
    };

    for slug in ["pass", "blocked"] {
        let md = reviews.join(format!("{slug}-verdict.md"));
        assert_eq!(
            gate_blocks(slug),
            hook_blocks(&md),
            "{slug}: verdict-gate and validate-gate-2.cjs disagree"
        );
    }
    assert!(gate_blocks("blocked"), "the FAIL fixture must block");

    // The known gap: tolerated by verdict-gate, blocked by the hook. When this
    // assertion fails the gap was closed — update the case and the changelog.
    assert!(!gate_blocks("legacy"));
    assert!(hook_blocks(&reviews.join("legacy-verdict.md")));
}
