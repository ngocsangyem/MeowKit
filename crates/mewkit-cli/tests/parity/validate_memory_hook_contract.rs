//! The pre-ship guard must accept this binary as its memory linter.
//!
//! `validate --memory` is not read by a person: `.claude/hooks/lib/
//! memory-store-lint.cjs` spawns the configured CLI with it at a ship boundary
//! and turns a non-zero exit into a BLOCK. So the test runs the SHIPPED guard,
//! under Node, with `MEOWKIT_CLI` pointing at the RUST binary — not a
//! reimplementation of what the guard does.
//!
//! Both verdicts are exercised. A guard that blocked everything would pass a
//! block-only test, and a guard that blocked nothing would pass a pass-only
//! test; only the pair proves it reads the exit code.
use std::path::Path;

use crate::parity;

/// Requires the shipped guard and prints its verdict as `exit\n<stderr lines>`.
/// `MEOWKIT_CLI` is the documented override the guard checks first, and it
/// requires an executable FILE, so the binary under test qualifies.
const DRIVER: &str = r#"
'use strict';
const path = require('node:path');
const root = process.env.PROJECT_ROOT;
const { lintMemoryStore } = require(path.join(root, '.claude', 'hooks', 'lib', 'memory-store-lint.cjs'));
const result = lintMemoryStore({ root, env: { MEOWKIT_CLI: process.env.MEOWKIT_CLI } });
process.stdout.write(`${result.exit}\n${result.stderr.join('\n')}\n`);
"#;

fn copy_tree(source: &Path, dest: &Path) {
    std::fs::create_dir_all(dest).expect("create a directory");
    for entry in std::fs::read_dir(source).expect("read a directory") {
        let entry = entry.expect("a directory entry");
        let target = dest.join(entry.file_name());
        if entry.path().is_dir() {
            copy_tree(&entry.path(), &target);
        } else {
            std::fs::copy(entry.path(), &target).expect("copy a file");
        }
    }
}

/// Run the shipped guard over one fixture and return what it reported.
fn run_guard(case: &'static str, fixture: &'static str) -> Option<String> {
    parity::check(case)?;
    let repo = parity::repo_root();
    let scratch = tempfile::Builder::new()
        .prefix("mewkit-memory-hook-")
        .tempdir()
        .expect("create the scratch dir");
    let project = scratch.path().join("project");
    parity::copy_fixture(fixture, &project);
    copy_tree(
        &repo.join(".claude").join("hooks").join("lib"),
        &project.join(".claude").join("hooks").join("lib"),
    );

    let binary = project.join(if cfg!(windows) {
        "mewkit.exe"
    } else {
        "mewkit"
    });
    std::fs::copy(env!("CARGO_BIN_EXE_mewkit"), &binary).expect("copy the binary");

    let driver = scratch.path().join("drive-memory-guard.cjs");
    std::fs::write(&driver, DRIVER).expect("write the driver");
    let out = std::process::Command::new("node")
        .arg(&driver)
        .current_dir(&project)
        .env("PROJECT_ROOT", &project)
        .env("MEOWKIT_CLI", &binary)
        .env("HOME", scratch.path())
        .env("USERPROFILE", scratch.path())
        .output()
        .expect("spawn the guard driver");
    assert!(
        out.status.success(),
        "the guard failed: {}",
        String::from_utf8_lossy(&out.stderr)
    );
    Some(String::from_utf8_lossy(&out.stdout).into_owned())
}

#[test]
#[ignore = "needs node and the TS build"]
fn the_pre_ship_guard_blocks_on_a_poisoned_store_linted_by_this_binary() {
    let Some(reported) = run_guard("memory-guard-blocks", "validate-memory-poisoned") else {
        return;
    };
    // exit 2 is what BLOCKS. exit 1 would print "BLOCKED" and let the commit
    // through, which is the one outcome a write guard must not produce.
    assert!(
        reported.starts_with("2\n"),
        "the guard did not block: {reported:?}"
    );
    assert!(
        reported.contains("PRE-SHIP BLOCKED: team memory store lint failed."),
        "the guard blocked without its own message: {reported:?}"
    );
    // The binary's own finding has to reach the block text, or the human sees a
    // block with no reason.
    assert!(
        reported.contains("Memory injection:") && reported.contains("instruction-like text"),
        "the guard did not relay this binary's finding: {reported:?}"
    );
    assert!(
        !reported.contains("SKIP: mewkit CLI not found"),
        "the guard skipped instead of linting: {reported:?}"
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn the_pre_ship_guard_passes_a_clean_store_linted_by_this_binary() {
    let Some(reported) = run_guard("memory-guard-passes", "validate-memory-clean") else {
        return;
    };
    assert_eq!(
        reported.trim_end(),
        "0",
        "a clean store must produce exit 0 and no stderr: {reported:?}"
    );
}
