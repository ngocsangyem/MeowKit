//! The retired eval pack through the real binary. No install writes eval
//! cases and `eval` is not a pack name; a project an earlier kit gave the
//! pack loses the files it recorded under `.meowkit/eval/` on `upgrade` and
//! `uninstall`, except a file edited since, which is kept.
mod support;

use mewkit_core::fsx::sha256_hex;
use serde_json::Value;
use support::temp_home::TempHome;
use support::{code, read, text, write};

const PRISTINE: &str = ".meowkit/eval/cook/eval/paired-cases.yaml";
const EDITED: &str = ".meowkit/eval/fix/eval/trigger-cases.yaml";
const INDEX: &str = ".meowkit/state/ownership/claude-code.json";

fn ok(env: &TempHome, args: &[&str]) -> String {
    let out = env.with_kit(args);
    assert_eq!(code(&out), 0, "{args:?}: {}", text(&out));
    text(&out)
}

/// A Claude Code install whose index records two pack files, as an earlier
/// kit that installed the pack left it; `EDITED` changed after install.
fn installed_with_pack() -> TempHome {
    let env = TempHome::new();
    ok(&env, &["init", "--target", "claude-code", "--yes"]);
    let p = env.project();
    let mut index: Value = serde_json::from_str(&read(&p, INDEX)).unwrap();
    for (rel, body) in [(PRISTINE, "cases: []\n"), (EDITED, "cases: []\n")] {
        write(&p, rel, body);
        index["paths"][rel] = Value::String(sha256_hex(body.as_bytes()));
    }
    std::fs::write(p.join(INDEX), serde_json::to_vec_pretty(&index).unwrap()).unwrap();
    write(&p, EDITED, "cases: []\n# my own case\n");
    env
}

fn recorded(env: &TempHome, rel: &str) -> bool {
    let index: Value = serde_json::from_str(&read(&env.project(), INDEX)).unwrap();
    index["paths"].get(rel).is_some()
}

#[test]
fn a_fresh_install_writes_nothing_under_the_eval_folder() {
    let env = TempHome::new();
    ok(&env, &["init", "--target", "claude-code,codex", "--yes"]);
    assert!(!env.project().join(".meowkit/eval").exists());
}

#[test]
fn eval_is_refused_like_any_unknown_skill_pack() {
    let env = TempHome::new();
    let out = env.with_kit(&[
        "init",
        "--target",
        "codex",
        "--yes",
        "--skill-packs",
        "eval",
    ]);
    assert_ne!(code(&out), 0, "{}", text(&out));
    assert!(text(&out).contains("unknown skill pack"), "{}", text(&out));
    assert!(!env.project().join(".meowkit/eval").exists());
}

#[test]
fn upgrade_removes_the_pristine_pack_files_and_keeps_an_edited_one() {
    let env = installed_with_pack();
    let out = env.with_kit(&["upgrade", "--yes"]);
    let p = env.project();
    assert!(!p.join(PRISTINE).exists(), "{}", text(&out));
    assert!(!recorded(&env, PRISTINE));
    assert_eq!(read(&p, EDITED), "cases: []\n# my own case\n");
    assert!(
        text(&out).contains("edited since install"),
        "{}",
        text(&out)
    );
}

#[test]
fn uninstall_removes_the_pristine_pack_files() {
    let env = installed_with_pack();
    let out = env.with_kit(&["uninstall", "--yes"]);
    let p = env.project();
    assert!(!p.join(PRISTINE).exists(), "{}", text(&out));
    assert!(p.join(EDITED).exists(), "an edited file is kept");
}
