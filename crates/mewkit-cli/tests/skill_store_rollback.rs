//! Rollback over a skill's digest history, and the doctor row that checks the
//! store against the ownership ledgers.
mod support;

use mewkit_core::skill_store::{read_tree, tree_digest};
use support::skill_store::{SKILL, installed, ledger, row, status};
use support::temp_home::TempHome;
use support::{code, text, write};

/// The digest of the skill's files on disk now.
fn on_disk(env: &TempHome) -> String {
    tree_digest(&read_tree(&env.project().join(SKILL)).unwrap())
}

/// Edit SKILL.md to `body` and store it as the overlay.
fn overlay(env: &TempHome, body: &str) {
    write(&env.project(), &format!("{SKILL}/SKILL.md"), body);
    let out = env.mewkit(&["skill", "overlay", "fix"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
}

#[test]
fn rollback_restores_the_original_tree_after_two_changes() {
    let env = installed();
    let original = on_disk(&env);
    assert_eq!(row(&status(&env), SKILL)["digest"], original.as_str());
    let kit_text = std::fs::read(env.project().join(SKILL).join("SKILL.md")).unwrap();
    overlay(&env, "first change\n");
    let first = on_disk(&env);
    overlay(&env, "second change\n");
    assert_ne!(on_disk(&env), first);

    let out = env.mewkit(&["skill", "rollback", "fix", "--to", &original[..12]]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(text(&out).contains("backup: "), "{}", text(&out));
    assert_eq!(on_disk(&env), original, "the original tree hash is back");
    assert_eq!(
        std::fs::read(env.project().join(SKILL).join("SKILL.md")).unwrap(),
        kit_text
    );
    let fix = row(&status(&env), SKILL).clone();
    assert_eq!(
        fix["status"], "kit",
        "the overlay is no longer applied: {fix:#}"
    );
    assert_eq!(fix["digest"], original.as_str());
    assert!(
        fix["drift"].to_string().contains("waiting for approval"),
        "{fix:#}"
    );
    // The changed trees stay in the history, so the way forward is open too.
    assert!(fix["history"].to_string().contains(&first), "{fix:#}");
}

#[test]
fn rollback_without_a_digest_goes_back_one_step_and_refuses_an_unknown_one() {
    let env = installed();
    overlay(&env, "first change\n");
    let first = on_disk(&env);
    overlay(&env, "second change\n");
    let out = env.mewkit(&["skill", "rollback", "fix"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert_eq!(on_disk(&env), first);
    let out = env.mewkit(&["skill", "rollback", "fix", "--to", "0000000000"]);
    assert_eq!(code(&out), 1, "{}", text(&out));
    assert_eq!(on_disk(&env), first, "nothing changed");
}

#[test]
fn rollback_settles_a_skill_an_older_binary_changed_and_doctor_reports_it() {
    let env = installed();
    let original = on_disk(&env);
    let doctor_row = |env: &TempHome| {
        let out = env.mewkit(&["doctor", "--json"]);
        assert_eq!(
            code(&out),
            0,
            "a warn row changes no exit code: {}",
            text(&out)
        );
        let rows: serde_json::Value = serde_json::from_slice(&out.stdout).unwrap();
        rows.as_array()
            .unwrap()
            .iter()
            .find(|r| r["name"] == "skill store")
            .cloned()
            .expect("a skill store row")
    };
    assert_eq!(doctor_row(&env)["status"], "ok");

    let rel = format!("{SKILL}/SKILL.md");
    let older = b"what an older binary wrote\n";
    std::fs::write(env.project().join(&rel), older).unwrap();
    let mut doc: serde_json::Value =
        serde_json::from_slice(&std::fs::read(ledger(&env)).unwrap()).unwrap();
    doc["paths"][&rel] = mewkit_core::fsx::sha256_hex(older).into();
    std::fs::write(ledger(&env), serde_json::to_vec_pretty(&doc).unwrap()).unwrap();

    let found = doctor_row(&env);
    assert_eq!(found["status"], "warn", "{found:#}");
    assert!(
        found["detail"].to_string().contains("unverified"),
        "{found:#}"
    );
    assert_eq!(row(&status(&env), SKILL)["status"], "unverified");

    let out = env.mewkit(&["skill", "rollback", "fix"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert_eq!(
        on_disk(&env),
        original,
        "the tree before the older binary ran"
    );
    assert_eq!(row(&status(&env), SKILL)["status"], "kit");
}
