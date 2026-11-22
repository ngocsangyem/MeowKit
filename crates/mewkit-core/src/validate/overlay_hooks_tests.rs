use std::fs;
use std::path::Path;

use super::*;

fn write(root: &Path, rel: &str, text: &str) {
    let path = root.join(rel);
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, text).unwrap();
}

/// A source checkout with one Codex overlay whose hooks file names `script`.
fn checkout(script: &str) -> tempfile::TempDir {
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path();
    write(
        root,
        "kit/overlays/codex/files/.codex/hooks.json",
        &format!(
            r#"{{"hooks":{{"Stop":[{{"hooks":[{{"type":"command","command":"node \"$(git rev-parse --show-toplevel)/{script}\""}}]}}]}}}}"#
        ),
    );
    write(
        root,
        "kit/overlays/codex/files/.codex/hooks/completion-check.cjs",
        "const { run } = require('./lib/core.cjs');\n",
    );
    write(
        root,
        "kit/overlays/codex/files/.codex/hooks/lib/core.cjs",
        "module.exports = {};\n",
    );
    write(
        root,
        ".claude/hooks/handlers.json",
        r#"{"handlers":[{"event":"Stop","handler":"./handlers/post-session.cjs","toggleKey":"post-session"}]}"#,
    );
    write(
        root,
        ".claude/hooks/handlers/post-session.cjs",
        "module.exports = () => null;\n",
    );
    dir
}

#[test]
fn every_reference_resolving_passes() {
    let dir = checkout(".codex/hooks/completion-check.cjs");
    let rows = check_hook_references(dir.path());
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].status, Status::Pass, "{}", rows[0].detail);
}

#[test]
fn an_overlay_naming_a_missing_hook_fails() {
    let dir = checkout(".codex/hooks/removed-handler.cjs");
    let rows = check_hook_references(dir.path());
    assert_eq!(rows[0].status, Status::Fail, "{}", rows[0].detail);
    assert!(
        rows[0].detail.contains(
            "kit/overlays/codex/files/.codex/hooks.json names .codex/hooks/removed-handler.cjs"
        ),
        "{}",
        rows[0].detail
    );
    // A FAIL row fails the run.
    assert_ne!(super::super::exit_code(&rows, false), 0);
}

#[test]
fn a_reference_into_another_overlay_resolves() {
    // Pi and OMP load the guard that ships in the shared `.agents` overlay.
    let dir = checkout(".codex/hooks/completion-check.cjs");
    write(
        dir.path(),
        "kit/overlays/agents/files/.agents/meowkit/hooks/guard.cjs",
        "\n",
    );
    write(
        dir.path(),
        "kit/overlays/pi/files/.pi/extensions/meowkit.ts",
        "const GUARD = \".agents/meowkit/hooks/guard.cjs\";\n",
    );
    assert_eq!(check_hook_references(dir.path())[0].status, Status::Pass);
}

#[test]
fn a_guard_requiring_a_missing_module_fails() {
    let dir = checkout(".codex/hooks/completion-check.cjs");
    fs::remove_file(
        dir.path()
            .join("kit/overlays/codex/files/.codex/hooks/lib/core.cjs"),
    )
    .unwrap();
    let rows = check_hook_references(dir.path());
    assert_eq!(rows[0].status, Status::Fail);
    assert!(
        rows[0].detail.contains("requires ./lib/core.cjs"),
        "{}",
        rows[0].detail
    );
}

#[test]
fn a_registry_entry_for_a_removed_handler_fails() {
    let dir = checkout(".codex/hooks/completion-check.cjs");
    fs::remove_file(dir.path().join(".claude/hooks/handlers/post-session.cjs")).unwrap();
    let rows = check_hook_references(dir.path());
    assert_eq!(rows[0].status, Status::Fail);
    assert!(
        rows[0]
            .detail
            .contains(".claude/hooks/handlers.json registers ./handlers/post-session.cjs"),
        "{}",
        rows[0].detail
    );
}

#[test]
fn a_prose_path_in_a_comment_is_not_a_reference() {
    let dir = checkout(".codex/hooks/completion-check.cjs");
    write(
        dir.path(),
        "kit/overlays/omp/files/.omp/hooks/pre/meowkit.ts",
        "// HookAPI (src/extensibility/hooks/types.ts)\n",
    );
    assert_eq!(check_hook_references(dir.path())[0].status, Status::Pass);
}

#[test]
fn a_json_path_is_not_read_as_a_shorter_script_path() {
    let dir = checkout(".codex/hooks/completion-check.cjs");
    write(
        dir.path(),
        "kit/overlays/codex/files/.codex/hooks/privacy-block.cjs",
        "deny(\".codex/hooks/hook-runtime-config.json is missing\");\n",
    );
    assert_eq!(check_hook_references(dir.path())[0].status, Status::Pass);
}

#[test]
fn outside_the_source_checkout_there_is_no_row() {
    let dir = tempfile::tempdir().unwrap();
    assert!(check_hook_references(dir.path()).is_empty());
}
