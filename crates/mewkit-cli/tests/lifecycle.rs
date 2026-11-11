//! `init`, `upgrade` and `uninstall` end to end, in a temp home and project.
mod support;

use support::kit::sha_tree;
use support::temp_home::TempHome;
use support::{code, read, text, write};

const USER_AGENTS: &str = "# Mine\n\nKeep it short.\n";
const USER_HOOKS: &str = "{\n  \"version\": 1,\n  \"hooks\": {\n    \"stop\": [\n      {\n        \"command\": \"say done\"\n      }\n    ]\n  }\n}\n";
const EDITED: &str = ".cursor/agents/advisor.md";

#[test]
fn init_then_uninstall_keeps_user_text_hooks_and_edits() {
    let env = TempHome::new();
    let p = env.project();
    write(&p, "AGENTS.md", USER_AGENTS);
    write(&p, ".cursor/hooks.json", USER_HOOKS);
    let out = env.with_kit(&["init", "--target", "codex,cursor"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    write(&p, EDITED, "my own advisor\n");

    let before = sha_tree(&p);
    let dry = env.with_kit(&["uninstall", "--target", "all"]);
    assert_eq!(
        code(&dry),
        3,
        "dry run with pending changes: {}",
        text(&dry)
    );
    assert_eq!(sha_tree(&p), before, "a dry run changes nothing");

    let out = env.with_kit(&["uninstall", "--target", "all", "--yes"]);
    assert_eq!(code(&out), 6, "an edited file was kept: {}", text(&out));
    assert!(text(&out).contains(EDITED), "{}", text(&out));
    assert_eq!(read(&p, "AGENTS.md"), USER_AGENTS);
    assert_eq!(read(&p, ".cursor/hooks.json"), USER_HOOKS);
    assert_eq!(read(&p, EDITED), "my own advisor\n");
    let left: Vec<_> = sha_tree(&p)
        .into_keys()
        .filter(|k| k.extension().is_some())
        .collect();
    assert_eq!(left.len(), 3, "only the user's files remain: {left:?}");
    assert!(
        p.join(".meowkit/backups")
            .read_dir()
            .unwrap()
            .next()
            .is_some(),
        "a backup exists"
    );
}

#[test]
fn a_second_uninstall_has_nothing_to_do() {
    let env = TempHome::new();
    assert_eq!(code(&env.with_kit(&["init", "--target", "codex"])), 0);
    let out = env.with_kit(&["uninstall", "--yes"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(sha_tree(&env.project()).is_empty());
    let again = env.mewkit_next(&["uninstall", "--yes"]);
    assert_eq!(code(&again), 0);
    assert!(
        text(&again).contains("nothing to uninstall"),
        "{}",
        text(&again)
    );
}

#[test]
fn upgrade_keeps_an_edit_until_forced_and_keeps_the_packs() {
    let env = TempHome::new();
    let p = env.project();
    let out = env.with_kit(&["init", "--target", "cursor", "--skill-packs", "core,media"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    let skills = |p: &std::path::Path| p.join(".cursor/skills").read_dir().unwrap().count();
    let installed = skills(&p);
    write(&p, EDITED, "mine\n");

    let out = env.with_kit(&["upgrade"]);
    assert_eq!(code(&out), 6, "{}", text(&out));
    assert_eq!(read(&p, EDITED), "mine\n");
    assert_eq!(skills(&p), installed, "packs come from the index");

    let out = env.with_kit(&["upgrade", "--force"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert_ne!(read(&p, EDITED), "mine\n");

    let core_only = TempHome::new();
    assert_eq!(
        code(&core_only.with_kit(&["init", "--target", "cursor", "--skill-packs", "core"])),
        0
    );
    assert!(
        skills(&core_only.project()) < installed,
        "media adds skills"
    );
}

#[test]
fn upgrade_and_uninstall_name_what_is_not_installed() {
    let env = TempHome::new();
    let out = env.with_kit(&["upgrade", "--target", "codex"]);
    assert_eq!(code(&out), 2, "{}", text(&out));
    let out = env.mewkit_next(&["init", "--target", "vscode"]);
    assert_eq!(code(&out), 2, "{}", text(&out));
}

#[test]
fn global_init_and_uninstall_leave_home_as_it_was() {
    let env = TempHome::new();
    let home = env.home();
    write(
        &home,
        ".claude/settings.json",
        "{\n  \"model\": \"opus\"\n}\n",
    );
    let before: Vec<_> = sha_tree(&home)
        .into_iter()
        .filter(|(k, _)| !k.starts_with(".mewkit"))
        .collect();
    let out = env.with_kit(&["init", "--global", "--target", "all"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(
        home.join(".mewkit/state/ownership/claude-code.json")
            .is_file()
    );
    assert!(
        sha_tree(&env.project()).is_empty(),
        "the project is untouched"
    );
    let out = env.with_kit(&["uninstall", "--global", "--yes"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    let after: Vec<_> = sha_tree(&home)
        .into_iter()
        .filter(|(k, _)| !k.starts_with(".mewkit"))
        .collect();
    assert_eq!(after, before);
}
