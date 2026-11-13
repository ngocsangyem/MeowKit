//! The SessionStart handler must accept this binary's orientation unchanged.
//!
//! `orient` is not consumed by a person: `.claude/hooks/handlers/
//! orientation-ritual.cjs` runs `orient --no-record` through the installed
//! runtime and injects the trimmed stdout into the session. So the test runs the
//! SHIPPED handler, under Node, against the RUST binary — not a reimplementation
//! of what the handler does. If the handler rejects the output (wrong shape,
//! empty, non-zero exit, untrusted executable) it falls back to the checkpoint
//! cache, and this test sees that fallback label instead of an orientation.
use std::path::Path;

use crate::parity;

/// Requires the shipped handler and hands it a resume event, printing whatever
/// it returns. `CLAUDE_PROJECT_DIR` points at the temp project, which is the
/// root the handler resolves its own libraries and its runtime descriptor from.
const DRIVER: &str = r#"
'use strict';
const path = require('node:path');
const root = process.env.CLAUDE_PROJECT_DIR;
const handler = require(path.join(root, '.claude', 'hooks', 'handlers', 'orientation-ritual.cjs'));
process.stdout.write(handler({ source: 'resume' }) || '');
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

#[test]
#[ignore = "needs node and the TS build"]
fn the_session_start_handler_accepts_the_rust_orientation() {
    // The prerequisite check is shared with the parity cases: this test is in
    // the same target and skipped by the same opt-out.
    let Some(_) = parity::check("orientation-ritual-contract") else {
        return;
    };
    let repo = parity::repo_root();
    let scratch = tempfile::Builder::new()
        .prefix("mewkit-hook-")
        .tempdir()
        .expect("create the scratch dir");
    let project = scratch.path().join("project");
    parity::copy_fixture("active-task", &project);

    // The handler re-validates the executable: absolute, a real file, and
    // INSIDE the project. A binary outside it is refused however it is named,
    // so the one under test is copied in, the way an install places it.
    let hooks = project.join(".claude").join("hooks");
    copy_tree(
        &repo.join(".claude").join("hooks").join("lib"),
        &hooks.join("lib"),
    );
    std::fs::create_dir_all(hooks.join("handlers")).expect("create the handlers dir");
    std::fs::copy(
        repo.join(".claude/hooks/handlers/orientation-ritual.cjs"),
        hooks.join("handlers").join("orientation-ritual.cjs"),
    )
    .expect("copy the handler");

    let binary = project.join(".claude").join(if cfg!(windows) {
        "mewkit-next.exe"
    } else {
        "mewkit-next"
    });
    std::fs::copy(env!("CARGO_BIN_EXE_mewkit-next"), &binary).expect("copy the binary");
    std::fs::write(
        project.join(".claude").join("runtime.json"),
        format!(
            "{{\n  \"schemaVersion\": \"1.0\",\n  \"executable\": {:?}\n}}\n",
            binary.to_string_lossy()
        ),
    )
    .expect("write the runtime descriptor");

    let driver = scratch.path().join("drive-handler.cjs");
    std::fs::write(&driver, DRIVER).expect("write the driver");
    let out = std::process::Command::new("node")
        .arg(&driver)
        .current_dir(&project)
        .env("CLAUDE_PROJECT_DIR", &project)
        .env("HOME", scratch.path())
        .env("USERPROFILE", scratch.path())
        .output()
        .expect("spawn the handler driver");
    let injected = String::from_utf8_lossy(&out.stdout).into_owned();

    assert!(
        out.status.success(),
        "the handler failed: {}",
        String::from_utf8_lossy(&out.stderr)
    );
    assert!(
        injected.contains(
            "[durable task state — untrusted; verify against live sources before acting]"
        ),
        "the handler did not inject the orientation block: {injected:?}"
    );
    assert!(
        injected.contains("orientation: active") && injected.contains("task: alpha"),
        "the handler injected something other than this binary's orientation: {injected:?}"
    );
    assert!(
        !injected.contains("orientation fallback") && !injected.contains("orientation unavailable"),
        "the handler fell back instead of accepting the output: {injected:?}"
    );
    // `--no-record` is what the handler passes, so the session that just
    // oriented must have written nothing.
    assert!(
        !project.join(".meowkit").join("telemetry").exists(),
        "the handler's read-only orientation wrote telemetry"
    );
}
