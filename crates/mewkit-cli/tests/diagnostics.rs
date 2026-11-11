//! `versions`, `providers` and `doctor`: read-only reports. Every scratch
//! home has a space in its path (see `TempHome`).
mod support;

use serde_json::Value;
use support::temp_home::TempHome;
use support::{archive, code, text, write};

fn json(out: &std::process::Output) -> Value {
    serde_json::from_slice(&out.stdout).unwrap_or_else(|e| panic!("{e}: {}", text(out)))
}

#[test]
fn versions_lists_installed_and_cached_kits_offline() {
    let env = TempHome::new();
    let out = env.mewkit_next(&["versions", "--offline", "--json"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    let doc = json(&out);
    assert_eq!(doc["installed"], serde_json::json!([]));
    assert!(doc["available"].is_null(), "--offline asks nothing");
    assert_eq!(doc["kitContract"]["min"], 1);

    let scratch = tempfile::tempdir().unwrap();
    let (zip, sha) = archive(scratch.path());
    let zip = zip.to_string_lossy().into_owned();
    let out = env.mewkit_next(&[
        "init",
        "--target",
        "codex",
        "--kit-archive",
        &zip,
        "--kit-sha256",
        &sha,
        "--allow-unverified-kit",
    ]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    let doc = json(&env.mewkit_next(&["versions", "--offline", "--json"]));
    assert_eq!(doc["installed"][0]["target"], "codex");
    assert_eq!(doc["installed"][0]["scope"], "project");
    assert_eq!(doc["installed"][0]["origin"], "archive");
    assert_eq!(doc["cached"]["kits"].as_array().unwrap().len(), 1);
    assert_eq!(doc["cached"]["kits"][0]["origin"], "archive");
}

#[test]
fn providers_reports_each_runtime_projection() {
    let env = TempHome::new();
    let out = env.with_kit(&["providers", "--json"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    let rows = json(&out);
    let rows = rows.as_array().unwrap();
    assert_eq!(rows.len(), 3);
    for r in rows {
        assert!(r["files"].as_u64().unwrap() > 0, "{r}");
        assert!(r["skills"].as_u64().unwrap() > 0, "{r}");
    }
    let core = json(&env.with_kit(&["providers", "--json", "--target", "codex"]));
    assert_eq!(core.as_array().unwrap().len(), 1);
    assert!(
        std::fs::read_dir(env.project()).unwrap().next().is_none(),
        "providers writes nothing"
    );
}

#[test]
fn doctor_passes_a_clean_install_and_fails_a_missing_hook_script() {
    let env = TempHome::new();
    let p = env.project();
    assert_eq!(
        code(&env.with_kit(&["init", "--target", "claude-code,codex,cursor"])),
        0
    );
    let out = env.mewkit_next(&["doctor", "--json"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    let checks = json(&out);
    let find = |name: &str| -> Value {
        checks
            .as_array()
            .unwrap()
            .iter()
            .find(|c| c["name"] == name)
            .cloned()
            .unwrap_or_else(|| panic!("no {name}: {checks}"))
    };
    assert_eq!(find("codex (project)")["status"], "ok");
    assert_eq!(find("codex hooks (project)")["status"], "ok");
    assert_eq!(
        find("codex trust")["status"],
        "warn",
        "a temp project is not trusted"
    );

    write(&p, ".codex/agents/advisor.toml", "mine\n");
    let script = std::fs::read_dir(p.join(".claude/hooks"))
        .unwrap()
        .map(|e| e.unwrap().path())
        .find(|f| {
            f.extension().is_some_and(|e| e == "cjs")
                && std::fs::read_to_string(p.join(".claude/settings.json"))
                    .unwrap()
                    .contains(f.file_name().unwrap().to_str().unwrap())
        })
        .expect("a registered hook script");
    std::fs::remove_file(&script).unwrap();
    let out = env.mewkit_next(&["doctor"]);
    assert_eq!(code(&out), 1, "{}", text(&out));
    assert!(
        text(&out).contains("registered but missing"),
        "{}",
        text(&out)
    );
    assert!(text(&out).contains("1 edited"), "{}", text(&out));
}

#[test]
fn doctor_warns_about_two_scopes_and_a_project_relying_on_global_hooks() {
    let env = TempHome::new();
    assert_eq!(
        code(&env.with_kit(&["init", "--target", "codex", "--global"])),
        0
    );
    write(&env.project(), ".meowkit/config.yaml", "tdd: off\n");
    let out = env.mewkit_next(&["doctor", "--target", "codex"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(
        text(&out).contains("no project install of codex"),
        "{}",
        text(&out)
    );

    assert_eq!(code(&env.with_kit(&["init", "--target", "codex"])), 0);
    let out = env.mewkit_next(&["doctor", "--target", "codex"]);
    assert!(
        text(&out).contains("installed both in this project and globally"),
        "{}",
        text(&out)
    );
}

#[test]
fn doctor_finds_global_hook_scripts_under_a_home_with_spaces() {
    let env = TempHome::new();
    assert!(env.home().to_string_lossy().contains(' '));
    for t in ["claude-code", "codex"] {
        let out = env.with_kit(&["init", "--target", t, "--global"]);
        assert_eq!(code(&out), 0, "{}", text(&out));
    }
    let out = env.mewkit_next(&["doctor", "--global"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    let report = text(&out);
    assert!(!report.contains("registered but missing"), "{report}");
    assert!(report.contains("kit hook scripts found"), "{report}");

    std::fs::remove_file(env.home().join(".codex/hooks.json")).unwrap();
    let report = text(&env.mewkit_next(&["doctor", "--global"]));
    assert!(report.contains("no kit hook runs"), "{report}");
}

/// Global Cursor hooks run from `~/.cursor`, so their `./hooks/…` paths start
/// there: doctor finds them, and still notices one that is gone.
#[test]
fn doctor_resolves_global_cursor_hooks_from_the_cursor_dir() {
    let env = TempHome::new();
    let out = env.with_kit(&["init", "--target", "cursor", "--global"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    let out = env.mewkit_next(&["doctor", "--global", "--target", "cursor"]);
    assert_eq!(code(&out), 0, "{}", text(&out));

    std::fs::remove_file(env.home().join(".cursor/hooks/privacy-read-gate.cjs")).unwrap();
    let out = env.mewkit_next(&["doctor", "--global", "--target", "cursor"]);
    assert_eq!(code(&out), 1, "{}", text(&out));
    assert!(
        text(&out).contains("missing: ./hooks/privacy-read-gate.cjs"),
        "{}",
        text(&out)
    );
}
