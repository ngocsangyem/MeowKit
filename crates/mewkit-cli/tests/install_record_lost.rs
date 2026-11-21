//! What `init` and `upgrade` do when the install record, the kit cache, or
//! both are gone: the state a fresh clone or a cleaned project is in.
//!
//! The ownership index is the only record of which files the kit installed.
//! Without it every file that differs from the new kit reads as the user's,
//! so an install over an older kit kept the old files beside the new ones and
//! removed nothing. These cases hold the three answers to that: the record is
//! rebuilt from the release the files came from, an install that cannot be
//! rebuilt is refused before it writes, and the record is no longer ignored
//! by git, so a clone carries it.
mod support;

use std::path::Path;

use support::gate_kit::{GATE_SCRIPT_NAME, GATES, GateHook, current_archive};
use support::gate_retire::{
    assert_gate_fully_retired, index_path, installed_from_previous_kit, upgrade_to_current,
};
use support::kit::sha_tree;
use support::temp_home::TempHome;
use support::{code, read, text, write};

/// The version the previous-kit fixture claims.
const PREVIOUS: &str = "2.14.0";

/// `init` onto this checkout's kit, from a local archive: no network request.
fn init_current(env: &TempHome, gate: &GateHook, extra: &[&str]) -> std::process::Output {
    let (zip, sha) = current_archive();
    let zip = zip.to_string_lossy().into_owned();
    let mut args = vec![
        "init",
        "--target",
        gate.runtime,
        "--kit-archive",
        &zip,
        "--kit-sha256",
        sha,
        "--allow-unverified-kit",
    ];
    args.extend_from_slice(extra);
    env.mewkit(&args)
}

/// The paths the install recorded for `gate`'s runtime, project-relative.
fn recorded_paths(project: &Path, gate: &GateHook) -> Vec<String> {
    let doc: serde_json::Value =
        serde_json::from_str(&read(project, &index_path(gate))).expect("parse the index");
    doc["paths"]
        .as_object()
        .expect("the index lists paths")
        .keys()
        .cloned()
        .collect()
}

/// A kit file that both kits ship unchanged and that is plain text.
fn a_kept_kit_file(project: &Path, gate: &GateHook) -> String {
    recorded_paths(project, gate)
        .into_iter()
        .find(|p| p.ends_with("SKILL.md"))
        .expect("the kit installs a skill")
}

#[test]
fn init_rebuilds_a_lost_record_from_the_release_the_files_came_from() {
    for gate in &GATES {
        let env = installed_from_previous_kit(gate);
        let project = env.project();
        let edited = a_kept_kit_file(&project, gate);
        std::fs::remove_dir_all(project.join(".meowkit/state")).expect("lose the record");
        write(&project, &edited, "my own rewrite of this skill\n");
        let mine = format!(
            "{}/my-own-notes.md",
            gate.installed_file.rsplit_once('/').unwrap().0
        );
        write(&project, &mine, "written by the user\n");

        // Claude Code installs name their kit; the others need it named.
        let named = ["--adopt-from", PREVIOUS];
        let extra: &[&str] = if gate.runtime == "claude-code" {
            &[]
        } else {
            &named
        };
        let out = init_current(&env, gate, extra);
        let shown = text(&out);
        assert!(
            shown.contains(&format!("rebuilt from kit {PREVIOUS}")),
            "[{}] the rebuild must be reported: {shown}",
            gate.runtime
        );
        // The file the new kit dropped went, with its registration.
        assert_gate_fully_retired(&env, gate);
        // The user's files are untouched: one the kit never shipped, and one
        // the kit ships that the user rewrote.
        assert_eq!(read(&project, &mine), "written by the user\n");
        assert_eq!(read(&project, &edited), "my own rewrite of this skill\n");
        assert!(
            shown.contains(&edited),
            "[{}] a kept file must be named: {shown}",
            gate.runtime
        );
        // The record is back, owns no retired path and not the rewritten file.
        let paths = recorded_paths(&project, gate);
        assert!(paths.len() > 20, "[{}] {} paths", gate.runtime, paths.len());
        assert!(!paths.iter().any(|p| p.contains(GATE_SCRIPT_NAME)));
        assert!(!paths.contains(&edited), "[{}] {edited}", gate.runtime);
    }
}

#[test]
fn init_refuses_to_lay_a_kit_over_an_older_one_it_cannot_identify() {
    for gate in &GATES {
        let env = installed_from_previous_kit(gate);
        let project = env.project();
        // An older kit: many of its files differ from the kit being installed.
        for path in recorded_paths(&project, gate)
            .iter()
            .filter(|p| p.ends_with(".md"))
            .take(25)
        {
            let text = read(&project, path);
            write(&project, path, &format!("{text}\nfrom an older kit\n"));
        }
        // No record and no copy of the kit it came from.
        std::fs::remove_dir_all(project.join(".meowkit")).expect("lose the kit state");
        let before = sha_tree(&project);

        let out = init_current(&env, gate, &[]);
        let shown = text(&out);
        assert_eq!(code(&out), 1, "[{}] {shown}", gate.runtime);
        assert!(
            shown.contains("nothing was written") && shown.contains("--force"),
            "[{}] the refusal must say what to do: {shown}",
            gate.runtime
        );
        assert_eq!(sha_tree(&project), before, "[{}] {shown}", gate.runtime);
        assert!(
            !project.join(index_path(gate)).exists(),
            "[{}] a refused install must leave no record",
            gate.runtime
        );

        // `--force` is the stated way through, and backs up what it replaces.
        let out = init_current(&env, gate, &["--force", "--yes"]);
        assert_eq!(code(&out), 0, "[{}] forced: {}", gate.runtime, text(&out));
        assert!(project.join(index_path(gate)).is_file());
        assert!(project.join(".meowkit/backups").is_dir());
    }
}

/// A project with a few files of its own at kit paths is not an older kit:
/// they are kept and named, as before.
#[test]
fn a_few_files_of_the_users_at_kit_paths_do_not_block_an_install() {
    let gate = &GATES[0];
    let env = TempHome::new();
    write(
        &env.project(),
        ".claude/settings.json",
        "{\"mine\": true}\n",
    );
    write(&env.project(), "CLAUDE.md", "# my project\n");
    let out = init_current(&env, gate, &[]);
    assert_ne!(code(&out), 1, "{}", text(&out));
    assert!(env.project().join(index_path(gate)).is_file());
}

#[test]
fn an_upgrade_with_no_copy_of_the_old_kit_keeps_dropped_files_and_says_so() {
    for gate in &GATES {
        let env = installed_from_previous_kit(gate);
        std::fs::remove_dir_all(env.project().join(".meowkit/cache")).expect("lose the cache");
        let out = upgrade_to_current(&env, &[]);
        let shown = text(&out);
        assert!(
            shown.contains(&format!("kit {PREVIOUS} is not in the cache")),
            "[{}] {shown}",
            gate.runtime
        );
        // An archive install names no published release, so nothing was
        // downloaded and nothing unproved was removed.
        assert!(env.project().join(gate.installed_file).is_file());
    }
}

/// Git must carry the install record and nothing else of the kit's state.
#[test]
fn the_install_record_is_not_ignored_by_git_and_the_cache_is() {
    let gate = &GATES[0];
    let env = installed_from_previous_kit(gate);
    let git = |args: &[&str]| {
        env.command("git")
            .args(args)
            .output()
            .expect("spawn git")
            .status
            .success()
    };
    assert!(git(&["init", "-q"]), "git init");
    let record = index_path(gate);
    // `check-ignore` succeeds when the path IS ignored.
    assert!(
        !git(&["check-ignore", "-q", &record]),
        "{record} is ignored"
    );
    for ignored in [
        ".meowkit/cache/kits",
        ".meowkit/state/other.json",
        ".meowkit/backups/x",
    ] {
        assert!(
            git(&["check-ignore", "-q", ignored]),
            "{ignored} is tracked"
        );
    }
}
