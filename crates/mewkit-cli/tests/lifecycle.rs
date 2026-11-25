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
fn the_shared_block_stays_until_the_last_runtime_that_reads_it_leaves() {
    let env = TempHome::new();
    let p = env.project();
    write(&p, "AGENTS.md", USER_AGENTS);
    let out = env.with_kit(&["init", "--target", "codex,cursor"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    let both = read(&p, "AGENTS.md");
    assert_eq!(both.matches("<!-- mewkit:begin meowkit -->").count(), 1);

    let out = env.with_kit(&["uninstall", "--target", "codex", "--yes"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(text(&out).contains("block stays"), "{}", text(&out));
    assert_eq!(read(&p, "AGENTS.md"), both, "Cursor still reads the block");
    assert!(!p.join(".codex").exists());

    let out = env.with_kit(&["uninstall", "--target", "cursor", "--yes"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert_eq!(read(&p, "AGENTS.md"), USER_AGENTS);
}

#[test]
fn a_shared_block_file_the_kit_created_goes_with_the_last_runtime() {
    let env = TempHome::new();
    let p = env.project();
    assert_eq!(code(&env.with_kit(&["init", "--target", "codex"])), 0);
    assert_eq!(code(&env.with_kit(&["init", "--target", "cursor"])), 0);
    let out = env.with_kit(&["uninstall", "--target", "codex", "--yes"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(p.join("AGENTS.md").is_file());
    let out = env.with_kit(&["uninstall", "--target", "cursor", "--yes"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(sha_tree(&p).is_empty(), "{:?}", sha_tree(&p));
}

#[test]
fn adding_then_removing_a_runtime_that_shares_the_skills_root_leaves_a_fresh_install() {
    let env = TempHome::new();
    let p = env.project();
    assert_eq!(code(&env.with_kit(&["init", "--target", "codex"])), 0);
    let alone = sha_tree(&p);

    let out = env.with_kit(&["init", "--target", "omp"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(
        text(&out).contains("codex is installed here and what it installs depends"),
        "{}",
        text(&out)
    );
    assert!(p.join(".agents/meowkit/hooks/guard.cjs").is_file());
    let skill = std::fs::read_to_string(p.join(".agents/skills/mk-cook/SKILL.md")).unwrap();
    assert!(
        !skill.contains("$mk-"),
        "the shared wording has no Codex form"
    );

    let out = env.with_kit(&["uninstall", "--target", "omp", "--yes"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    let kit_files = |tree: &std::collections::BTreeMap<std::path::PathBuf, String>| {
        tree.iter()
            .filter(|(path, _)| !path.starts_with(".meowkit"))
            .map(|(path, sha)| (path.clone(), sha.clone()))
            .collect::<Vec<_>>()
    };
    assert_eq!(kit_files(&sha_tree(&p)), kit_files(&alone));

    let out = env.with_kit(&["uninstall", "--target", "codex", "--yes"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(
        kit_files(&sha_tree(&p)).is_empty(),
        "{:?}",
        kit_files(&sha_tree(&p))
    );
}

#[test]
fn omp_switches_the_claude_import_off_only_while_claude_code_is_installed() {
    let env = TempHome::new();
    let p = env.project();
    let config = p.join(".omp/config.yml");
    assert_eq!(code(&env.with_kit(&["init", "--target", "omp"])), 0);
    assert!(
        !config.exists(),
        "nothing to switch off beside no other runtime"
    );

    let out = env.with_kit(&["init", "--target", "claude-code"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert_eq!(
        std::fs::read_to_string(&config).unwrap(),
        "disabledProviders: [claude]\n"
    );

    let out = env.with_kit(&["uninstall", "--target", "claude-code", "--yes"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(!config.exists(), "{}", text(&out));
}

#[test]
fn a_second_uninstall_has_nothing_to_do() {
    let env = TempHome::new();
    assert_eq!(code(&env.with_kit(&["init", "--target", "codex"])), 0);
    let out = env.with_kit(&["uninstall", "--yes"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(sha_tree(&env.project()).is_empty());
    let again = env.mewkit(&["uninstall", "--yes"]);
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
    assert_eq!(
        code(&out),
        3,
        "no terminal: --force needs --yes; {}",
        text(&out)
    );
    assert_eq!(
        read(&p, EDITED),
        "mine\n",
        "an unconfirmed --force writes nothing"
    );

    let out = env.with_kit(&["upgrade", "--force", "--yes"]);
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
    let out = env.mewkit(&["init", "--target", "vscode"]);
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

#[test]
fn a_kit_dir_without_allow_unverified_kit_is_refused_and_writes_nothing() {
    let env = TempHome::new();
    let dir = support::kit::kit().dir.to_string_lossy().into_owned();
    let out = env.mewkit(&["init", "--target", "codex", "--kit-dir", &dir]);
    assert_eq!(code(&out), 2, "{}", text(&out));
    assert!(
        text(&out).contains("--allow-unverified-kit"),
        "{}",
        text(&out)
    );
    assert!(sha_tree(&env.project()).is_empty());
}

#[test]
fn a_global_kit_dir_install_is_refused_with_yes_or_without_a_terminal() {
    let env = TempHome::new();
    let dir = support::kit::kit().dir.to_string_lossy().into_owned();
    let base = [
        "init",
        "--global",
        "--target",
        "claude-code",
        "--kit-dir",
        &dir,
        "--allow-unverified-kit",
    ];
    for extra in [&["--yes"][..], &[][..]] {
        let args: Vec<&str> = base.iter().copied().chain(extra.iter().copied()).collect();
        let out = env.mewkit(&args);
        assert_eq!(code(&out), 2, "{extra:?}: {}", text(&out));
        assert!(text(&out).contains("--global"), "{}", text(&out));
        assert!(!env.home().join(".claude/settings.json").exists());
    }
}

#[test]
fn an_older_kit_version_than_the_installed_one_needs_force() {
    let env = TempHome::new();
    let out = env.with_kit(&["init", "--target", "codex"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    let before = sha_tree(&env.project());
    let out = env.mewkit(&["init", "--target", "codex", "--kit-version", "v0.0.1"]);
    assert_eq!(code(&out), 2, "{}", text(&out));
    assert!(text(&out).contains("--force"), "{}", text(&out));
    assert_eq!(sha_tree(&env.project()), before);
}
