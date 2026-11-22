//! The opt-in eval pack through the real binary: off by default, selected with
//! `--skill-packs eval` or `pack add eval`, installed to `.meowkit/eval/` and
//! recorded in the ownership index, kept by `upgrade`, removed by `uninstall`
//! and `pack remove`, and read by `eval run` as trusted kit content.
mod support;

use std::collections::BTreeSet;
use std::path::Path;

use support::temp_home::TempHome;
use support::{code, kit, text};

const PACK_DIR: &str = ".meowkit/eval";
const CASE: &str = ".meowkit/eval/cook/eval/paired-cases.yaml";
const INDEX: &str = ".meowkit/state/ownership/claude-code.json";

fn ok(env: &TempHome, args: &[&str]) -> String {
    let out = env.with_kit(args);
    assert_eq!(code(&out), 0, "{args:?}: {}", text(&out));
    text(&out)
}

/// Pack paths a runtime's index records.
fn recorded(env: &TempHome, runtime: &str) -> BTreeSet<String> {
    let file = env
        .project()
        .join(format!(".meowkit/state/ownership/{runtime}.json"));
    let doc: serde_json::Value = serde_json::from_slice(&std::fs::read(file).unwrap()).unwrap();
    doc["paths"]
        .as_object()
        .unwrap()
        .keys()
        .filter(|p| p.starts_with(&format!("{PACK_DIR}/")))
        .cloned()
        .collect()
}

/// Files on disk under the pack folder, project-relative.
fn on_disk(root: &Path) -> BTreeSet<String> {
    let mut out = BTreeSet::new();
    let mut todo = vec![root.join(PACK_DIR)];
    while let Some(dir) = todo.pop() {
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries {
            let path = entry.unwrap().path();
            if path.is_dir() {
                todo.push(path);
            } else {
                let rel = path
                    .strip_prefix(root)
                    .unwrap()
                    .to_string_lossy()
                    .replace('\\', "/");
                out.insert(rel);
            }
        }
    }
    out
}

fn dry_run(env: &TempHome, extra: &[&str]) -> std::process::Output {
    let mut args = vec!["eval", "run", "--suite", "baseline", "--dry-run"];
    args.extend_from_slice(extra);
    env.mewkit(&args)
}

/// The `case-set hash ...` from a dry run's last line.
fn case_set_hash(out: &std::process::Output) -> String {
    let stdout = String::from_utf8_lossy(&out.stdout);
    let line = stdout.lines().last().unwrap_or_default().to_owned();
    line.rsplit(' ').next().unwrap_or_default().to_owned()
}

#[test]
fn a_default_install_has_no_eval_folder() {
    let env = TempHome::new();
    ok(&env, &["init", "--target", "claude-code", "--yes"]);
    assert!(!env.project().join(PACK_DIR).exists());
    assert!(recorded(&env, "claude-code").is_empty());
}

#[test]
fn selecting_the_pack_installs_the_cases_and_changes_no_skills_tree() {
    let plain = TempHome::new();
    ok(&plain, &["init", "--target", "claude-code", "--yes"]);
    let env = TempHome::new();
    ok(
        &env,
        &[
            "init",
            "--target",
            "claude-code",
            "--yes",
            "--skill-packs",
            "eval",
        ],
    );

    let files = on_disk(&env.project());
    assert!(files.contains(CASE), "{files:?}");
    assert_eq!(
        recorded(&env, "claude-code"),
        files,
        "every pack file is in the index"
    );
    // `runtime.json` names the project's own path, so it differs between any two projects.
    let tree = |e: &TempHome| {
        let mut t = kit::sha_tree(&e.project().join(".claude"));
        t.remove(Path::new("runtime.json"));
        t
    };
    assert_eq!(tree(&env), tree(&plain), "the .claude/ tree is unchanged");
    // A full install stays a full install: the index names no pack subset.
    let index: serde_json::Value =
        serde_json::from_slice(&std::fs::read(env.project().join(INDEX)).unwrap()).unwrap();
    assert_eq!(index["packs"], serde_json::json!([]));

    // `eval run` reads the installed pack without --trust-cases, and it is the
    // same case set as the kit's source.
    let out = dry_run(&env, &[]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    let source = kit::repo().join(".claude/skills");
    let src = dry_run(
        &env,
        &["--case-root", &source.to_string_lossy(), "--trust-cases"],
    );
    assert_eq!(code(&src), 0, "{}", text(&src));
    assert_eq!(case_set_hash(&out), case_set_hash(&src));

    // `upgrade` keeps the pack without being asked again.
    ok(&env, &["upgrade", "--yes"]);
    assert_eq!(on_disk(&env.project()), files);

    // `uninstall` takes it out with the rest of the install.
    ok(&env, &["uninstall", "--yes"]);
    assert!(
        on_disk(&env.project()).is_empty(),
        "{:?}",
        on_disk(&env.project())
    );
}

#[test]
fn an_edited_or_stray_pack_file_is_not_run_as_kit_content() {
    let env = TempHome::new();
    ok(
        &env,
        &[
            "init",
            "--target",
            "claude-code",
            "--yes",
            "--skill-packs",
            "eval",
        ],
    );
    let case = env.project().join(CASE);
    let edited = format!("{}\n# edited\n", std::fs::read_to_string(&case).unwrap());
    std::fs::write(&case, edited).unwrap();
    let out = dry_run(&env, &[]);
    assert_ne!(code(&out), 0, "{}", text(&out));
    assert!(
        text(&out).contains("not a file the kit installed"),
        "{}",
        text(&out)
    );
    // Read on purpose, it runs.
    let out = dry_run(&env, &["--case-root", PACK_DIR, "--trust-cases"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
}

#[test]
fn pack_add_and_remove_manage_the_pack_on_an_existing_install() {
    let env = TempHome::new();
    ok(&env, &["init", "--target", "claude-code", "--yes"]);
    let listed = ok(&env, &["pack", "list"]);
    assert!(listed.contains("[opt-in] eval"), "{listed}");

    let added = ok(&env, &["pack", "add", "eval"]);
    assert!(added.contains("Added eval"), "{added}");
    let files = on_disk(&env.project());
    assert!(files.contains(CASE));
    assert_eq!(recorded(&env, "claude-code"), files);
    assert!(ok(&env, &["pack", "list"]).contains("[installed] eval"));

    let mixed = env.with_kit(&["pack", "add", "eval", "testing"]);
    assert_ne!(code(&mixed), 0, "{}", text(&mixed));

    ok(&env, &["pack", "remove", "eval", "--yes"]);
    assert!(on_disk(&env.project()).is_empty());
    assert!(recorded(&env, "claude-code").is_empty());
}

#[test]
fn codex_takes_the_pack_beside_its_own_skill_packs() {
    let env = TempHome::new();
    ok(
        &env,
        &[
            "init",
            "--target",
            "codex",
            "--yes",
            "--skill-packs",
            "eval",
        ],
    );
    let files = on_disk(&env.project());
    assert!(files.contains(CASE), "{files:?}");
    assert_eq!(recorded(&env, "codex"), files);
    assert!(
        !env.project().join(".agents/skills/mk-cook/eval").exists(),
        "no case under the skills root"
    );
    ok(&env, &["uninstall", "--yes"]);
    assert!(on_disk(&env.project()).is_empty());
}
