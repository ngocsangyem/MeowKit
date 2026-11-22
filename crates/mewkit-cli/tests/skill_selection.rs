//! `install_default: false` and the kit's `retiredSkills` decide which skills
//! an install lays down; the machine-local selection file and the chosen packs
//! opt a skill back in, and what is installed already stays installed.
//!
//! Each case runs the real binary against a copy of this checkout's kit with
//! one marker added, because the shipped kit sets neither marker.
mod support;

use std::path::{Path, PathBuf};
use std::process::Output;

use serde_json::{Value, json};
use support::temp_home::TempHome;
use support::{code, copy_tree, kit, text};

/// A skill in the `atlassian` pack and outside every pack the core profile has.
const OPT_IN: &str = "jira-search";
const SKILL_FILE: &str = ".claude/skills/jira-search/SKILL.md";
const SELECTION: &str = ".meowkit/state/skill-selection.json";

/// This checkout's kit copied to `name`, with `edit` applied to the copy.
fn kit_copy(name: &str, edit: impl Fn(&Path)) -> PathBuf {
    let out = Path::new(env!("CARGO_TARGET_TMPDIR")).join(name);
    let _ = std::fs::remove_dir_all(&out);
    copy_tree(&kit::kit().dir, &out);
    edit(&out);
    out
}

fn opt_in_kit(name: &str) -> PathBuf {
    kit_copy(name, mark_opt_in)
}

fn mark_opt_in(dir: &Path) {
    let file = dir.join(SKILL_FILE);
    let text = std::fs::read_to_string(&file).unwrap();
    let marked = text.replacen("\nname:", "\ninstall_default: false\nname:", 1);
    assert_ne!(text, marked, "the frontmatter has a name line to anchor on");
    std::fs::write(file, marked).unwrap();
}

fn retire(dir: &Path) {
    let file = dir.join(".meowkit/pack-manifest.json");
    let mut doc: Value = serde_json::from_slice(&std::fs::read(&file).unwrap()).unwrap();
    doc["retiredSkills"] = json!([format!("mk:{OPT_IN}")]);
    std::fs::write(file, serde_json::to_vec_pretty(&doc).unwrap()).unwrap();
}

fn run(env: &TempHome, kit_dir: &Path, args: &[&str]) -> Output {
    let dir = kit_dir.to_string_lossy().into_owned();
    let mut all = args.to_vec();
    all.extend(["--kit-dir", &dir, "--allow-unverified-kit"]);
    env.mewkit(&all)
}

fn init(env: &TempHome, kit_dir: &Path, extra: &[&str]) {
    let mut args = vec!["init", "--target", "claude-code", "--yes"];
    args.extend_from_slice(extra);
    let out = run(env, kit_dir, &args);
    assert_eq!(code(&out), 0, "init: {}", text(&out));
}

fn installed(env: &TempHome) -> bool {
    env.project().join(SKILL_FILE).is_file()
}

fn select(env: &TempHome, skills: &[&str]) {
    support::write(
        &env.project(),
        SELECTION,
        &json!({ "version": 1, "skills": skills }).to_string(),
    );
}

#[test]
fn an_opt_in_skill_installs_only_when_selected() {
    let kit = opt_in_kit("selection-opt-in");

    let env = TempHome::new();
    init(&env, &kit, &[]);
    assert!(!installed(&env), "a full install laid down an opt-in skill");
    assert!(env.project().join(".claude/skills/jira/SKILL.md").is_file());

    let env = TempHome::new();
    select(&env, &[&format!("mk:{OPT_IN}")]);
    init(&env, &kit, &[]);
    assert!(
        installed(&env),
        "a skill named in the selection was left out"
    );

    let env = TempHome::new();
    init(&env, &kit, &["--profile", "atlassian"]);
    assert!(installed(&env), "a skill in a chosen pack was left out");

    let env = TempHome::new();
    init(&env, &kit, &["--profile", "core"]);
    assert!(!installed(&env), "a pack without the skill selected it");
}

#[test]
fn a_retired_skill_never_installs_even_when_selected() {
    let kit = kit_copy("selection-retired", |dir| {
        mark_opt_in(dir);
        retire(dir);
    });
    let env = TempHome::new();
    select(&env, &[OPT_IN]);
    init(&env, &kit, &["--profile", "atlassian"]);
    assert!(!installed(&env), "a retired skill was installed");

    // Retirement reaches an install that already has the skill, too. The
    // first install comes from an archive, which is cached, so the upgrade can
    // corroborate the bytes it removes.
    let env = TempHome::new();
    let (zip, sha) = support::gate_kit::current_archive();
    let zip = zip.to_string_lossy().into_owned();
    let out = env.mewkit(&[
        "init",
        "--target",
        "claude-code",
        "--yes",
        "--kit-archive",
        &zip,
        "--kit-sha256",
        sha,
        "--allow-unverified-kit",
    ]);
    assert_eq!(code(&out), 0, "init: {}", text(&out));
    assert!(installed(&env));
    let out = run(&env, &kit, &["upgrade"]);
    assert_eq!(code(&out), 0, "upgrade: {}", text(&out));
    assert!(!installed(&env), "upgrade kept a retired skill");
}

#[test]
fn upgrading_an_install_without_a_selection_keeps_every_skill_and_records_them() {
    let env = TempHome::new();
    init(&env, &kit::kit().dir, &[]);
    assert!(installed(&env));
    assert!(!env.project().join(SELECTION).exists());
    let before = skill_dirs(&env.project());

    let kit = opt_in_kit("selection-upgrade");
    let out = run(&env, &kit, &["upgrade"]);
    assert_eq!(code(&out), 0, "upgrade: {}", text(&out));
    assert_eq!(
        skill_dirs(&env.project()),
        before,
        "upgrade changed the skill set"
    );

    let doc: Value =
        serde_json::from_slice(&std::fs::read(env.project().join(SELECTION)).unwrap()).unwrap();
    assert_eq!(doc["version"], 1);
    let recorded: Vec<String> = doc["skills"]
        .as_array()
        .unwrap()
        .iter()
        .map(|v| v.as_str().unwrap().to_owned())
        .collect();
    assert_eq!(
        recorded, before,
        "the selection must name every installed skill"
    );

    // What is installed counts as selected even with the file gone: re-running
    // init, adding a runtime and removing it again keep the skill.
    std::fs::remove_file(env.project().join(SELECTION)).unwrap();
    init(&env, &kit, &[]);
    assert!(
        installed(&env),
        "re-running init removed an installed skill"
    );
    let out = run(&env, &kit, &["init", "--target", "codex", "--yes"]);
    assert_eq!(code(&out), 0, "init codex: {}", text(&out));
    let out = run(&env, &kit, &["uninstall", "--target", "codex", "--yes"]);
    assert_eq!(code(&out), 0, "uninstall codex: {}", text(&out));
    assert!(
        installed(&env),
        "uninstalling another runtime removed the skill"
    );

    // A fresh install of the same kit still leaves the skill out.
    let fresh = TempHome::new();
    init(&fresh, &kit, &[]);
    assert!(!installed(&fresh));
}

#[test]
fn a_dry_run_upgrade_writes_no_selection() {
    let env = TempHome::new();
    init(&env, &kit::kit().dir, &[]);
    let out = run(&env, &kit::kit().dir, &["upgrade", "--dry-run"]);
    assert_eq!(code(&out), 0, "upgrade: {}", text(&out));
    assert!(!env.project().join(SELECTION).exists());
}

#[test]
fn a_malformed_selection_stops_the_install_with_nothing_written() {
    let kit = opt_in_kit("selection-malformed");
    let env = TempHome::new();
    support::write(&env.project(), SELECTION, "{\"skills\": \"jira-search\"}");
    let out = run(&env, &kit, &["init", "--target", "claude-code", "--yes"]);
    assert_ne!(code(&out), 0, "init: {}", text(&out));
    assert!(
        text(&out).contains("skill-selection.json"),
        "{}",
        text(&out)
    );
    assert!(!env.project().join(".claude").exists());
}

#[test]
fn the_installed_gitignore_keeps_the_selection_out_of_git() {
    let env = TempHome::new();
    init(&env, &kit::kit().dir, &[]);
    select(&env, &[OPT_IN]);
    let git = |args: &[&str]| {
        env.command("git")
            .args(args)
            .current_dir(env.project())
            .output()
            .expect("spawn git")
    };
    assert!(git(&["init", "-q"]).status.success());
    let ignored = |rel: &str| git(&["check-ignore", "-q", rel]).status.code() == Some(0);
    assert!(ignored(SELECTION), "the selection would be committed");
    assert!(
        !ignored(".meowkit/state/ownership/claude-code.json"),
        "the shared ownership index must stay committable"
    );
}

/// The installed `.claude/skills/` directory names, sorted.
fn skill_dirs(project: &Path) -> Vec<String> {
    let mut out: Vec<String> = std::fs::read_dir(project.join(".claude/skills"))
        .unwrap()
        .flatten()
        .filter(|e| e.path().join("SKILL.md").is_file())
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .collect();
    out.sort();
    out
}
