//! Indexing the skill store: read-only on skill files, idempotent, a digest
//! that ignores every mode bit but the execute bit, and the record an older
//! binary leaves behind when it changes the ledger without the sidecar.
mod support;

use mewkit_core::skill_store::{read_tree, tree_digest};
use support::kit::sha_tree;
use support::skill_store::{SKILL, installed, ledger, row, sidecar, status};
use support::{code, text};

#[test]
fn indexing_writes_no_skill_file_and_a_second_run_writes_the_same_sidecar() {
    let env = installed();
    let tree = sha_tree(&env.project());
    let first = status(&env);
    let bytes = std::fs::read(sidecar(&env)).expect("init wrote the sidecar");
    let second = status(&env);
    assert_eq!(sha_tree(&env.project()), tree, "no skill file changed");
    assert_eq!(std::fs::read(sidecar(&env)).unwrap(), bytes, "same bytes");
    assert_eq!(first, second);
    let fix = row(&first, SKILL);
    assert_eq!(fix["status"], "kit");
    assert_eq!(fix["owners"], serde_json::json!(["claude-code"]));
    assert_eq!(
        fix["base"], fix["digest"],
        "a pristine skill is its own base"
    );
}

#[cfg(unix)]
#[test]
fn the_digest_ignores_mode_bits_except_execute() {
    use std::os::unix::fs::PermissionsExt;
    let dir = tempfile::tempdir().unwrap();
    let file = dir.path().join("run.sh");
    std::fs::write(&file, "echo hi\n").unwrap();
    let mode = |m: u32| std::fs::set_permissions(&file, std::fs::Permissions::from_mode(m));
    mode(0o644).unwrap();
    let readable = tree_digest(&read_tree(dir.path()).unwrap());
    mode(0o600).unwrap();
    let private = tree_digest(&read_tree(dir.path()).unwrap());
    assert_eq!(readable, private, "same content, two modes, one digest");
    mode(0o755).unwrap();
    let exec = tree_digest(&read_tree(dir.path()).unwrap());
    assert_ne!(readable, exec, "the execute bit is part of the digest");
}

#[cfg(unix)]
#[test]
fn status_reports_the_same_digest_after_a_permission_only_change() {
    use std::os::unix::fs::PermissionsExt;
    let env = installed();
    let before = row(&status(&env), SKILL)["digest"].clone();
    let file = env.project().join(SKILL).join("SKILL.md");
    std::fs::set_permissions(&file, std::fs::Permissions::from_mode(0o600)).unwrap();
    assert_eq!(row(&status(&env), SKILL)["digest"], before);
    std::fs::set_permissions(&file, std::fs::Permissions::from_mode(0o755)).unwrap();
    let after = row(&status(&env), SKILL).clone();
    assert_ne!(after["digest"], before);
    assert_eq!(after["history"], serde_json::json!([before]));
}

#[test]
fn an_edit_shows_as_drift_and_moves_the_digest_into_history() {
    let env = installed();
    let before = row(&status(&env), SKILL)["digest"].clone();
    let file = env.project().join(SKILL).join("SKILL.md");
    std::fs::write(&file, "my own fix\n").unwrap();
    let doc = status(&env);
    let fix = row(&doc, SKILL);
    assert_eq!(fix["status"], "kit");
    assert_eq!(fix["base"], before, "the base stays the installed tree");
    assert_eq!(fix["history"], serde_json::json!([before]));
    assert!(fix["drift"].to_string().contains("SKILL.md"), "{fix:#}");
}

#[test]
fn a_ledger_changed_by_an_older_binary_marks_its_skills_unverified() {
    let env = installed();
    status(&env);
    let sidecar_before = std::fs::read(sidecar(&env)).unwrap();
    // What an older binary's upgrade leaves: new bytes for one skill file and
    // its new hash in the ledger, and the sidecar, which it does not know,
    // untouched.
    let rel = format!("{SKILL}/SKILL.md");
    let new = b"an older binary's kit\n";
    std::fs::write(env.project().join(&rel), new).unwrap();
    let mut doc: serde_json::Value =
        serde_json::from_slice(&std::fs::read(ledger(&env)).unwrap()).unwrap();
    doc["paths"][&rel] = mewkit_core::fsx::sha256_hex(new).into();
    std::fs::write(ledger(&env), serde_json::to_vec_pretty(&doc).unwrap()).unwrap();
    assert_eq!(std::fs::read(sidecar(&env)).unwrap(), sidecar_before);

    let doc = status(&env);
    let fix = row(&doc, SKILL);
    assert_eq!(fix["status"], "unverified", "{fix:#}");
    assert_eq!(fix["unverified"], true);
    assert_eq!(fix["state"], "kit", "the record is kept, not rebuilt");
    assert_eq!(row(&doc, ".claude/skills/review")["status"], "kit");
    assert_eq!(
        std::fs::read(env.project().join(&rel)).unwrap(),
        new,
        "the skill's files are left as they are"
    );
    // The flag sticks: a later index does not clear it.
    assert_eq!(row(&status(&env), SKILL)["status"], "unverified");

    // The older binary reads its ledger as before: the sidecar is a separate
    // file and the ledger carries no field it does not know.
    let read = mewkit_core::ownership::OwnershipIndex::load(&ledger(&env));
    assert!(read.is_ok_and(|i| i.is_some()), "the ledger still loads");
    let keys: Vec<String> = doc_keys(&ledger(&env));
    assert_eq!(
        keys,
        [
            "hooks",
            "kit_contract",
            "kit_version",
            "mcp_servers",
            "origin",
            "packs",
            "paths",
            "schema_version",
            "sections"
        ]
    );
}

#[test]
fn a_lifecycle_run_records_its_own_ledger_changes() {
    let env = installed();
    status(&env);
    let out = env.with_kit(&["upgrade"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    let doc = status(&env);
    let unverified: Vec<&serde_json::Value> = doc["skills"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|r| r["unverified"] == true)
        .collect();
    assert!(unverified.is_empty(), "{unverified:#?}");
}

fn doc_keys(file: &std::path::Path) -> Vec<String> {
    let doc: serde_json::Value = serde_json::from_slice(&std::fs::read(file).unwrap()).unwrap();
    let mut keys: Vec<String> = doc.as_object().unwrap().keys().cloned().collect();
    keys.sort();
    keys
}
