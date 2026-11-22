//! Install, upgrade and uninstall keep what the store records as the user's
//! (forked, local, unverified, overlaid) and say "kept" with the reason,
//! without the exit code that reports a kept edit.
mod support;

use support::skill_store::{SKILL, changed_kit, installed, ledger, row, status, with_kit_dir};
use support::{code, read, text, write};

/// A kit that also ships a skill called `name`.
fn kit_shipping(name: &str) -> tempfile::TempDir {
    let name = name.to_owned();
    changed_kit(move |root| {
        let dir = root.join(".claude/skills").join(&name);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(
            dir.join("SKILL.md"),
            format!("---\nname: mk:{name}\ndescription: the kit's {name}\n---\nkit text\n"),
        )
        .unwrap();
    })
}

#[test]
fn a_fork_is_a_user_owned_copy_that_no_kit_change_reaches() {
    let env = installed();
    let p = env.project();
    let out = env.mewkit(&["skill", "fork", "fix", "my-fix"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    let forked = read(&p, ".claude/skills/my-fix/SKILL.md");
    assert!(forked.starts_with("---\nname: my-fix\n"), "{forked}");
    let fork = row(&status(&env), ".claude/skills/my-fix").clone();
    assert_eq!(fork["status"], "forked");
    assert_eq!(fork["forkOf"], SKILL);
    assert_eq!(fork["owners"], serde_json::json!(["user"]));

    let kit = kit_shipping("my-fix");
    for args in [&["upgrade"][..], &["init", "--target", "claude-code"][..]] {
        let out = with_kit_dir(&env, kit.path(), args);
        assert_eq!(code(&out), 0, "{args:?}: {}", text(&out));
        assert!(
            text(&out).contains("kept .claude/skills/my-fix: forked"),
            "{args:?}: {}",
            text(&out)
        );
        assert_eq!(read(&p, ".claude/skills/my-fix/SKILL.md"), forked);
    }
    let out = env.mewkit(&["skill", "fork", "fix", "mk-nope"]);
    assert_eq!(code(&out), 2, "the kit's prefix is refused: {}", text(&out));
}

#[test]
fn a_local_skill_is_kept_when_the_kit_starts_shipping_its_name() {
    let env = installed();
    let p = env.project();
    let mine = "---\nname: mine\ndescription: mine\n---\nmy own skill\n";
    write(&p, ".claude/skills/mine/SKILL.md", mine);
    assert_eq!(row(&status(&env), ".claude/skills/mine")["status"], "local");
    let out = with_kit_dir(
        &env,
        kit_shipping("mine").path(),
        &["upgrade", "--force", "--yes"],
    );
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(
        text(&out).contains("kept .claude/skills/mine: local"),
        "{}",
        text(&out)
    );
    assert_eq!(read(&p, ".claude/skills/mine/SKILL.md"), mine);
}

#[test]
fn an_unverified_skill_is_kept_by_upgrade_even_with_force() {
    let env = installed();
    let p = env.project();
    status(&env);
    let rel = format!("{SKILL}/SKILL.md");
    let older = b"what an older binary wrote\n";
    std::fs::write(p.join(&rel), older).unwrap();
    let mut doc: serde_json::Value =
        serde_json::from_slice(&std::fs::read(ledger(&env)).unwrap()).unwrap();
    doc["paths"][&rel] = mewkit_core::fsx::sha256_hex(older).into();
    std::fs::write(ledger(&env), serde_json::to_vec_pretty(&doc).unwrap()).unwrap();

    let out = env.with_kit(&["upgrade", "--force", "--yes"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(
        text(&out).contains("kept .claude/skills/fix: unverified"),
        "{}",
        text(&out)
    );
    assert_eq!(std::fs::read(p.join(&rel)).unwrap(), older);
    assert_eq!(row(&status(&env), SKILL)["status"], "unverified");
}

/// A project with `fix` overlaid, and how many files the skill holds.
fn overlaid() -> (support::temp_home::TempHome, usize) {
    let env = installed();
    write(&env.project(), &format!("{SKILL}/SKILL.md"), "mine\n");
    let out = env.mewkit(&["skill", "overlay", "fix"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    let files = std::fs::read_dir(env.project().join(SKILL))
        .unwrap()
        .count();
    (env, files)
}

#[test]
fn uninstall_keeps_an_overlaid_skill_whole_and_lets_go_of_it() {
    let (env, files) = overlaid();
    let p = env.project();
    let out = env.with_kit(&["uninstall", "--yes"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(
        text(&out).contains("kept .claude/skills/fix: overlaid"),
        "{}",
        text(&out)
    );
    assert_eq!(read(&p, &format!("{SKILL}/SKILL.md")), "mine\n");
    assert_eq!(std::fs::read_dir(p.join(SKILL)).unwrap().count(), files);
    assert!(
        !ledger(&env).exists(),
        "the ledger lets go of the kept skill"
    );
    assert_eq!(row(&status(&env), SKILL)["status"], "local");
}

#[test]
fn a_kit_that_drops_an_overlaid_skill_does_not_retire_it() {
    let (env, files) = overlaid();
    let p = env.project();
    let retired = changed_kit(|root| std::fs::remove_dir_all(root.join(SKILL)).unwrap());
    let out = with_kit_dir(&env, retired.path(), &["upgrade"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(
        text(&out).contains("kept .claude/skills/fix: overlaid"),
        "{}",
        text(&out)
    );
    assert_eq!(std::fs::read_dir(p.join(SKILL)).unwrap().count(), files);
    // The skill is the user's now: a kit that ships the name again leaves it.
    assert_eq!(row(&status(&env), SKILL)["status"], "local");
    let out = env.with_kit(&["upgrade", "--force", "--yes"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(
        text(&out).contains("kept .claude/skills/fix: local"),
        "{}",
        text(&out)
    );
    assert_eq!(read(&p, &format!("{SKILL}/SKILL.md")), "mine\n");
}
