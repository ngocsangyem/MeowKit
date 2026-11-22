//! Helpers for the skill store tests: an installed project, `skill status`
//! as JSON, and a changed copy of the kit to upgrade to.
use std::path::{Path, PathBuf};
use std::process::Output;

use serde_json::Value;

use super::temp_home::TempHome;
use super::{code, copy_tree, kit, text};

/// The skill every store test works on.
pub const SKILL: &str = ".claude/skills/fix";

/// A project with Claude Code installed from this checkout's kit.
pub fn installed() -> TempHome {
    let env = TempHome::new();
    let out = env.with_kit(&["init", "--target", "claude-code"]);
    assert_eq!(code(&out), 0, "init: {}", text(&out));
    env
}

/// `mewkit` with the kit at `dir` after `args`.
pub fn with_kit_dir(env: &TempHome, dir: &Path, args: &[&str]) -> Output {
    let dir = dir.to_string_lossy().into_owned();
    let mut all: Vec<&str> = args.to_vec();
    all.extend(["--kit-dir", &dir, "--allow-unverified-kit"]);
    env.mewkit(&all)
}

/// A copy of this checkout's kit, changed by `edit` (given the copy's root).
pub fn changed_kit(edit: impl FnOnce(&Path)) -> tempfile::TempDir {
    let dir = tempfile::tempdir().expect("temp kit dir");
    copy_tree(&kit::kit().dir, dir.path());
    edit(dir.path());
    dir
}

/// `skill status --json`, which must succeed.
pub fn status(env: &TempHome) -> Value {
    let out = env.mewkit(&["skill", "status", "--json"]);
    assert_eq!(code(&out), 0, "skill status: {}", text(&out));
    serde_json::from_slice(&out.stdout).unwrap_or_else(|e| panic!("{e}: {}", text(&out)))
}

/// One skill's row in a status document.
pub fn row<'a>(doc: &'a Value, key: &str) -> &'a Value {
    doc["skills"]
        .as_array()
        .expect("skills")
        .iter()
        .find(|r| r["skill"] == key)
        .unwrap_or_else(|| panic!("{key} not in {doc:#}"))
}

/// The sidecar file of a project.
pub fn sidecar(env: &TempHome) -> PathBuf {
    env.project()
        .join(".meowkit/state/ownership/skill-store.json")
}

/// The project's Claude Code ownership ledger.
pub fn ledger(env: &TempHome) -> PathBuf {
    env.project()
        .join(".meowkit/state/ownership/claude-code.json")
}
