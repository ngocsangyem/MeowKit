//! `mewkit eval`: the paths that need no model turn — dry run, the ceiling
//! refusal, the trust refusal, and `compare` failing closed.

use std::fs;
use std::path::Path;
use std::process::{Command, Output};

const BIN: &str = env!("CARGO_BIN_EXE_mewkit");

const CASES: &str = "cases:\n  - id: cook-t1\n    skill: cook\n    kind: trigger\n    prompt: build the feature\n    expectTrigger: true\n  - id: cook-p1\n    skill: cook\n    kind: paired\n    prompt: add a flag\n    runs: 2\n    assertions:\n      - type: skillLoaded\n        skill: cook\n  - id: cook-x1\n    skill: cook\n    kind: trigger\n    suite: other\n    prompt: unrelated\n    expectTrigger: false\n";

fn project() -> tempfile::TempDir {
    let dir = tempfile::tempdir().expect("tmp");
    fs::create_dir_all(dir.path().join(".claude/skills/cook/eval")).expect("mkdir");
    fs::write(
        dir.path().join(".claude/skills/cook/eval/cases.yaml"),
        CASES,
    )
    .expect("write");
    dir
}

fn mewkit(cwd: &Path, args: &[&str]) -> Output {
    Command::new(BIN)
        .args(args)
        .current_dir(cwd)
        .env_remove("CLAUDE_CODE_OAUTH_TOKEN")
        .env_remove("ANTHROPIC_API_KEY")
        .output()
        .expect("runs")
}

fn text(o: &Output) -> String {
    format!(
        "{}{}",
        String::from_utf8_lossy(&o.stdout),
        String::from_utf8_lossy(&o.stderr)
    )
}

#[test]
fn dry_run_lists_the_suite_and_its_run_count() {
    let p = project();
    let o = mewkit(
        p.path(),
        &["eval", "run", "--suite", "baseline", "--dry-run"],
    );
    let out = text(&o);
    assert!(o.status.success(), "{out}");
    assert!(out.contains("cook-t1") && out.contains("cook-p1"), "{out}");
    assert!(!out.contains("cook-x1"), "other suite listed: {out}");
    assert!(out.contains("2 cases, 7 runs"), "{out}");
}

#[test]
fn a_run_without_a_ceiling_is_refused_before_anything_starts() {
    let p = project();
    let o = mewkit(p.path(), &["eval", "run", "--model", "m"]);
    assert_eq!(o.status.code(), Some(2), "{}", text(&o));
    assert!(text(&o).contains("--max-cost-usd"));
    assert!(
        !p.path().join(".meowkit").exists(),
        "nothing may be written"
    );
}

#[test]
fn a_run_without_auth_is_refused() {
    let p = project();
    let o = mewkit(
        p.path(),
        &[
            "eval",
            "run",
            "--model",
            "m",
            "--max-cost-usd",
            "1",
            "--max-runs",
            "1",
            "--kit-archive",
            "k.zip",
        ],
    );
    assert_eq!(o.status.code(), Some(1), "{}", text(&o));
    assert!(text(&o).contains("CLAUDE_CODE_OAUTH_TOKEN"));
}

#[test]
fn an_outside_case_root_needs_trust() {
    let p = project();
    let other = project();
    let root = other.path().join(".claude/skills");
    let root = root.to_str().expect("utf8");
    let o = mewkit(p.path(), &["eval", "run", "--case-root", root, "--dry-run"]);
    assert_eq!(o.status.code(), Some(2), "{}", text(&o));
    assert!(text(&o).contains("--trust-cases"));
    let o = mewkit(
        p.path(),
        &[
            "eval",
            "run",
            "--case-root",
            root,
            "--trust-cases",
            "--dry-run",
        ],
    );
    assert!(o.status.success(), "{}", text(&o));
}

fn report(dir: &Path, name: &str, hash: &str, outcome: &str) -> String {
    let body = format!(
        r#"{{"schemaVersion":1,"runtime":"claude-code","model":"m","caseSetHash":"{hash}","offArm":"scratch-install","complete":true,"cases":[{{"id":"t","skill":"cook","kind":"trigger","plannedRuns":1,"runs":[{{"outcome":"{outcome}"}}]}}],"marginPp":10}}"#
    );
    let path = dir.join(name);
    fs::write(&path, body).expect("write");
    path.display().to_string()
}

#[test]
fn compare_prints_deltas_and_refuses_different_case_sets() {
    let p = project();
    let a = report(p.path(), "a.json", "h1", "fail");
    let b = report(p.path(), "b.json", "h1", "pass");
    let o = mewkit(p.path(), &["eval", "compare", &a, &b]);
    assert!(o.status.success(), "{}", text(&o));
    assert!(text(&o).contains("beyond margin"), "{}", text(&o));

    let c = report(p.path(), "c.json", "h2", "pass");
    let o = mewkit(p.path(), &["eval", "compare", &a, &c]);
    assert_eq!(o.status.code(), Some(1));
    assert!(text(&o).contains("case sets differ"), "{}", text(&o));
}
