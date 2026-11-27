//! The Rust digest and classifier must agree with the hook's JavaScript, or a
//! job recorded here would never credit a verification there. Skipped when
//! `node` or `git` is not on PATH.
use std::path::{Path, PathBuf};
use std::process::Command;

use super::tree_digest::tree_digest;

fn hook_lib() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../.claude/hooks/lib/core/completion-check.cjs")
}

fn node(script: &str, cwd: &Path) -> Option<String> {
    let out = Command::new("node")
        .arg("-e")
        .arg(script)
        .current_dir(cwd)
        .output()
        .ok()?;
    out.status
        .success()
        .then(|| String::from_utf8_lossy(&out.stdout).trim().to_string())
}

fn git(dir: &Path, args: &[&str]) {
    let ok = Command::new("git")
        .args(args)
        .current_dir(dir)
        .output()
        .map(|o| o.status.success());
    assert_eq!(ok.ok(), Some(true), "git {args:?}");
}

#[test]
fn the_digest_matches_the_hook_before_and_after_commits_and_edits() {
    let lib = hook_lib();
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path();
    let script = format!(
        "process.stdout.write(String(require({:?}).treeDigest(process.cwd())))",
        lib.to_string_lossy()
    );
    if node("1", root).is_none() || Command::new("git").arg("--version").output().is_err() {
        eprintln!("skipped: node or git missing");
        return;
    }
    git(root, &["init", "-q"]);
    git(root, &["config", "user.email", "t@example.invalid"]);
    git(root, &["config", "user.name", "t"]);
    std::fs::write(root.join("a.txt"), "one\n").unwrap();
    git(root, &["add", "a.txt"]);
    // Unborn branch: staged diff only.
    assert_eq!(tree_digest(root), node(&script, root));
    git(root, &["commit", "-qm", "c"]);
    assert_eq!(tree_digest(root), node(&script, root));
    std::fs::write(root.join("a.txt"), "two\n").unwrap();
    std::fs::create_dir_all(root.join("sub")).unwrap();
    std::fs::write(root.join("sub/new file.txt"), "x").unwrap();
    std::fs::create_dir_all(root.join(".meowkit/state")).unwrap();
    std::fs::write(root.join(".meowkit/state/noise"), "x").unwrap();
    let ours = tree_digest(root);
    assert!(ours.is_some());
    assert_eq!(ours, node(&script, root));
    let outside = tempfile::tempdir().unwrap();
    assert_eq!(tree_digest(outside.path()), None);
}

#[test]
fn the_classifier_matches_the_hook() {
    let lib = hook_lib();
    let cases = [
        "cargo test",
        "pnpm exec vitest",
        "FOO=1 BAR=2 npm run lint",
        "make",
        "make -n all",
        "cd x && go build ./...",
        "npm test | tail",
        "a & b",
        "a &&& b",
        "tsc -p . --noEmit",
        "bash scripts/run-tests.sh",
        "uv run pytest -q",
        "cargo check",
        "",
    ];
    let json = serde_json::to_string(&cases).unwrap();
    let script = format!(
        "const c=require({:?});process.stdout.write(JSON.stringify({json}.map(x=>c.classifyCommand(x))))",
        lib.to_string_lossy()
    );
    let Some(out) = node(&script, Path::new(env!("CARGO_MANIFEST_DIR"))) else {
        eprintln!("skipped: node missing");
        return;
    };
    let theirs: Vec<Option<String>> = serde_json::from_str(&out).unwrap();
    let ours: Vec<Option<String>> = cases
        .iter()
        .map(|c| super::cmd_class::classify(c).map(str::to_string))
        .collect();
    assert_eq!(ours, theirs);
}
