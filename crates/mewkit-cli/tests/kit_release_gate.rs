//! The kit release gate: this checkout's kit, staged as `release-check.sh`
//! stages it, passes against this binary; a kit whose contract or minimum
//! binary version is out of reach fails it. Unix only: the gate is a bash
//! script run on the maintainer's machine.
#![cfg(unix)]
mod support;

use std::path::Path;
use std::process::{Command, Output};

use support::release::{node, repo};
use support::{code, text};

fn stage() -> tempfile::TempDir {
    let dir = tempfile::tempdir().unwrap();
    let kit = dir.path().join("kit");
    let out = node("stage-candidate-kit.cjs", &[&kit.to_string_lossy()]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    dir
}

fn gate(kit: &Path) -> Output {
    Command::new("bash")
        .arg(repo().join("scripts/release/check-kit-against-binary.sh"))
        .arg(env!("CARGO_BIN_EXE_mewkit"))
        .arg(kit)
        .output()
        .expect("run the gate")
}

fn set_contract(kit: &Path, edit: impl Fn(&mut serde_json::Value)) {
    let file = kit.join(".claude/kit-contract.json");
    let mut c: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&file).unwrap()).unwrap();
    edit(&mut c);
    std::fs::write(&file, c.to_string()).unwrap();
}

#[test]
fn the_candidate_kit_plans_for_every_runtime() {
    let dir = stage();
    let out = gate(&dir.path().join("kit"));
    assert_eq!(code(&out), 0, "{}", text(&out));
    for runtime in ["claude-code", "codex", "cursor"] {
        assert!(
            text(&out).contains(&format!("ok  {runtime}")),
            "{}",
            text(&out)
        );
    }
}

#[test]
fn a_kit_contract_beyond_the_binary_fails_the_release() {
    let dir = stage();
    let kit = dir.path().join("kit");
    set_contract(&kit, |c| c["kitContract"] = 99.into());
    let out = gate(&kit);
    assert_eq!(code(&out), 1, "{}", text(&out));
    assert!(
        text(&out).contains("uses kit contract 99"),
        "{}",
        text(&out)
    );

    set_contract(&kit, |c| {
        c["kitContract"] = 1.into();
        c["requires"]["mewkitMin"] = "999.0.0".into();
    });
    let out = gate(&kit);
    assert_eq!(code(&out), 1, "{}", text(&out));
    assert!(
        text(&out).contains("needs mewkit ≥ 999.0.0"),
        "{}",
        text(&out)
    );
}

#[test]
fn an_unreadable_kit_contract_fails_the_release() {
    let dir = stage();
    let kit = dir.path().join("kit");
    std::fs::write(kit.join(".claude/kit-contract.json"), "{ not json").unwrap();
    let out = gate(&kit);
    assert_eq!(code(&out), 1, "{}", text(&out));
    assert!(text(&out).contains("is invalid"), "{}", text(&out));
}
