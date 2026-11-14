//! `init` against both CLIs: the refusals that happen before anything is
//! fetched or written.
//!
//! A successful install is NOT compared here. The npm CLI downloads a release
//! and writes its own metadata, ledgers, launcher and kit copy; this binary
//! writes an ownership index and a cached kit. What an install lays down is
//! held to the npm CLI's output by `tests/golden/` (path set and bytes, with
//! the differences listed in `DIVERGENCES.md`) and by the adapter test that
//! resolves every profile with the npm CLI's own resolver; the flags are
//! exercised end to end in `tests/init_flags.rs`.
//!
//! One known difference, kept on purpose: `--target` with a name that is not a
//! runtime exits 1 in the npm CLI and 2 here. `--target` takes a list in this
//! binary, an unknown name is an invocation error as for every other mistyped
//! value, and `tests/lifecycle.rs` pins the 2.
use crate::parity;

fn init(
    name: &'static str,
    fixture: &'static str,
    args: &[&str],
) -> Option<(parity::Run, parity::Run)> {
    let mut argv = vec!["init"];
    argv.extend_from_slice(args);
    parity::case(name).fixture(fixture).args(&argv).run()
}

#[test]
#[ignore = "needs node and the TS build"]
fn delivery_is_refused_for_a_target_with_one_shape() {
    let Some((ts, _)) = init(
        "init-delivery-codex",
        "empty-project",
        &["--target", "codex", "--delivery", "plugin"],
    ) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("--delivery is meaningful for --target claude-code only"),
        "{}",
        ts.stderr
    );
    init(
        "init-delivery-cursor",
        "empty-project",
        &["--target", "cursor", "--delivery", "native"],
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn an_unknown_delivery_names_the_valid_ones() {
    let Some((ts, _)) = init(
        "init-delivery-unknown",
        "empty-project",
        &["--target", "claude-code", "--delivery", "bogus"],
    ) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr.contains("The deliveries are native, plugin."),
        "{}",
        ts.stderr
    );
    // No target at all means Claude Code, so the same refusal.
    init(
        "init-delivery-no-target",
        "empty-project",
        &["--delivery", "bogus"],
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn the_kit_source_repo_is_refused_unless_allowed() {
    let Some((ts, _)) = init("init-kit-source", "init-kit-source", &["--target", "codex"]) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("refusing to run in the MeowKit source repo"),
        "{}",
        ts.stderr
    );
}
