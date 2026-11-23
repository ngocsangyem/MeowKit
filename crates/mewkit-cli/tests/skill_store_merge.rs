//! `upgrade` merges a kit skill file the user edited with the kit's change
//! only when every guard holds: the cached previous kit matches the ledger,
//! the edits are separated and anchored, and the skill has eval cases.
//! Otherwise the user's file stays, is reported kept, and upgrade exits 6.
mod support;

use std::path::{Path, PathBuf};

use mewkit_core::fsx::sha256_hex;
use serde_json::{Value, json};
use support::skill_store::{SKILL, ledger, sidecar};
use support::temp_home::TempHome;
use support::{code, copy_tree, read, text, write, zip_tree};

const FILE: &str = ".claude/skills/fix/SKILL.md";
const BASE: &str = "---\nname: fix\ndescription: Fix a reported bug.\n---\n\n# Fix\n\n\
    Read the bug report first.\nReproduce the failure locally.\nFind the cause in the code.\n\
    Write the smallest patch.\nRun the related tests.\nSummarise what changed.\n";
const USER_LINE: &str = "Read the whole bug report first, twice.";
const KIT_LINE: &str = "Summarise what changed and why.";

/// A copy of this checkout's kit at `version`, with `fix`'s SKILL.md set to
/// `skill` and no eval cases inside the skill, zipped into `scratch`.
fn kit_zip(scratch: &Path, version: &str, skill: &str) -> (PathBuf, String) {
    let dir = scratch.join(format!("kit-{version}"));
    copy_tree(&support::kit::kit().dir, &dir);
    let contract = dir.join(".claude/kit-contract.json");
    let mut doc: Value =
        serde_json::from_str(&std::fs::read_to_string(&contract).unwrap()).unwrap();
    doc["kitVersion"] = json!(version);
    std::fs::write(&contract, serde_json::to_vec_pretty(&doc).unwrap()).unwrap();
    std::fs::write(dir.join(FILE), skill).unwrap();
    let _ = std::fs::remove_dir_all(dir.join(".claude/skills/fix/eval"));
    zip_tree(&dir, &scratch.join(format!("kit-{version}.zip")))
}

fn with_archive(env: &TempHome, zip: &(PathBuf, String), args: &[&str]) -> std::process::Output {
    let path = zip.0.to_string_lossy().into_owned();
    let mut all = args.to_vec();
    all.extend([
        "--kit-archive",
        &path,
        "--kit-sha256",
        &zip.1,
        "--allow-unverified-kit",
    ]);
    env.mewkit(&all)
}

/// A project with Claude Code installed from the previous kit, `fix`'s SKILL.md
/// edited by the user, the next kit zipped, and eval cases when `cases`.
struct Setup {
    env: TempHome,
    next: (PathBuf, String),
    _scratch: tempfile::TempDir,
}

fn setup(cases: bool) -> Setup {
    let scratch = tempfile::tempdir().unwrap();
    let prev = kit_zip(scratch.path(), "9.0.0", BASE);
    let next = kit_zip(
        scratch.path(),
        "9.1.0",
        &BASE.replace("Summarise what changed.", KIT_LINE),
    );
    let env = TempHome::new();
    let out = with_archive(&env, &prev, &["init", "--target", "claude-code"]);
    assert_eq!(code(&out), 0, "init: {}", text(&out));
    let p = env.project();
    let installed = read(&p, FILE);
    write(
        &p,
        FILE,
        &installed.replace("Read the bug report first.", USER_LINE),
    );
    if cases {
        write(
            &p,
            ".claude/skills/fix/eval/trigger-cases.yaml",
            "cases: []\n",
        );
    }
    // Index once so the store records the edited tree before the upgrade.
    assert_eq!(code(&env.mewkit(&["skill", "status", "--json"])), 0);
    Setup {
        env,
        next,
        _scratch: scratch,
    }
}

fn record(env: &TempHome) -> Value {
    let doc: Value = serde_json::from_str(&read(
        &env.project(),
        ".meowkit/state/ownership/skill-store.json",
    ))
    .unwrap();
    doc["records"][SKILL].clone()
}

fn assert_kept_side_by_side(s: &Setup, out: &std::process::Output, why: &str) {
    let p = s.env.project();
    assert_eq!(
        code(out),
        6,
        "an unmergeable edit still exits 6: {}",
        text(out)
    );
    let file = read(&p, FILE);
    assert!(
        file.contains(USER_LINE) && !file.contains(KIT_LINE),
        "{file}"
    );
    assert!(text(out).contains(&format!("kept {FILE}")), "{}", text(out));
    assert!(text(out).contains(why), "expected {why:?}: {}", text(out));
}

#[test]
fn separated_edits_merge_as_one_swap_with_a_history_entry_and_no_exit_6() {
    let s = setup(true);
    let p = s.env.project();
    let before = record(&s.env)["digest"].clone();
    let out = with_archive(&s.env, &s.next, &["upgrade"]);
    assert_eq!(
        code(&out),
        0,
        "a merged file is not a kept edit: {}",
        text(&out)
    );
    let file = read(&p, FILE);
    assert!(
        file.contains(USER_LINE) && file.contains(KIT_LINE),
        "{file}"
    );
    let out_text = text(&out);
    assert!(out_text.contains(&format!("merged your edit with the kit's change: {FILE}")));
    assert!(out_text.contains("eval of fix not run:"), "{out_text}");
    assert_eq!(
        out_text.matches("backup:").count(),
        1,
        "one swap: {out_text}"
    );
    // The ledger records the kit's bytes, so the file still counts as edited.
    let ledger_doc: Value =
        serde_json::from_str(&std::fs::read_to_string(ledger(&s.env)).unwrap()).unwrap();
    let recorded = ledger_doc["paths"][FILE].as_str().unwrap_or_default();
    assert!(!recorded.is_empty());
    assert_ne!(recorded, sha256_hex(file.as_bytes()));
    // A second upgrade to the same kit finds nothing new to merge or keep.
    let again = with_archive(&s.env, &s.next, &["upgrade"]);
    assert_eq!(code(&again), 0, "{}", text(&again));
    assert_eq!(read(&p, FILE), file);
    let after = record(&s.env);
    assert_ne!(after["digest"], before);
    assert!(
        after["history"].as_array().unwrap().contains(&before),
        "{after:#}"
    );
    assert!(sidecar(&s.env).is_file());
}

#[test]
fn a_cached_base_that_does_not_match_the_ledger_keeps_the_file() {
    let s = setup(true);
    let cache = s.env.project().join(".meowkit/cache/kits");
    for entry in std::fs::read_dir(&cache).unwrap().flatten() {
        let cached = entry.path().join("kit").join(FILE);
        if cached.is_file() {
            std::fs::write(
                &cached,
                BASE.replace("Run the related tests.", "Run all tests."),
            )
            .unwrap();
        }
    }
    let out = with_archive(&s.env, &s.next, &["upgrade"]);
    assert_kept_side_by_side(&s, &out, "does not match what was installed");
}

#[test]
fn no_cached_previous_kit_keeps_the_file() {
    let s = setup(true);
    std::fs::remove_dir_all(s.env.project().join(".meowkit/cache/kits")).unwrap();
    let out = with_archive(&s.env, &s.next, &["upgrade"]);
    assert_kept_side_by_side(&s, &out, "the previous kit is not in the cache");
}

#[test]
fn a_skill_without_eval_cases_keeps_the_file() {
    let s = setup(false);
    let out = with_archive(&s.env, &s.next, &["upgrade"]);
    assert_kept_side_by_side(&s, &out, "no eval cases");
}

#[test]
fn a_ledger_changed_by_an_older_binary_keeps_the_skill_unmerged() {
    let s = setup(true);
    let p = s.env.project();
    let file = ledger(&s.env);
    let mut doc: Value = serde_json::from_str(&std::fs::read_to_string(&file).unwrap()).unwrap();
    let keys: Vec<String> = doc.as_object().unwrap().keys().cloned().collect();
    doc["paths"][FILE] = json!(sha256_hex(read(&p, FILE).as_bytes()));
    std::fs::write(&file, serde_json::to_vec_pretty(&doc).unwrap()).unwrap();
    let edited = read(&p, FILE);
    let out = with_archive(&s.env, &s.next, &["upgrade"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(text(&out).contains("unverified"), "{}", text(&out));
    assert!(!text(&out).contains("merged your edit"), "{}", text(&out));
    assert_eq!(read(&p, FILE), edited);
    // The ledger keeps the shape an older binary reads: no new fields.
    let after: Value = serde_json::from_str(&std::fs::read_to_string(&file).unwrap()).unwrap();
    let after_keys: Vec<String> = after.as_object().unwrap().keys().cloned().collect();
    assert_eq!(after_keys, keys);
}
