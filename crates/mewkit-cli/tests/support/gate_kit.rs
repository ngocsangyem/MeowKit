//! The previous kit: the one that still carried the plan gate on all three
//! runtimes, built so a test can install from it and then upgrade off it.
//!
//! `upgrade` only REMOVES a file the new kit dropped when the bytes on disk
//! match what the old kit installed, and it reads the old kit back out of the
//! cache to prove that. A `--kit-dir` install records `Origin::LocalDir` and is
//! never cached, so these tests install from an ARCHIVE. The archive also
//! claims an older `kitVersion`, so the cache lookup for the installed version
//! cannot land on the kit being upgraded TO.

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use serde_json::{Value, json};

use super::kit;

/// One minor behind the checkout's kit, so the two archives resolve apart.
const PREVIOUS_VERSION: &str = "2.14.0";

/// Enough of a hook to install and register; the tests never run it.
const GATE_SCRIPT: &str =
    "#!/usr/bin/env node\n'use strict';\n// the retired plan gate\nprocess.exit(0);\n";

/// What one runtime's plan gate looked like in the kit and in an install.
pub struct GateHook {
    pub runtime: &'static str,
    /// The hook script, kit-relative.
    kit_file: &'static str,
    /// The file that registers it, kit-relative.
    kit_registration: &'static str,
    /// The event it was registered on.
    event: &'static str,
    /// Claude Code and Codex group handlers under a matcher; Cursor's list is flat.
    matcher: Option<&'static str>,
    /// The command line, spelled the way that runtime spells a kit hook path.
    command: &'static str,
    /// The hook script once installed, project-relative.
    pub installed_file: &'static str,
    /// The file that registers it once installed, project-relative.
    pub installed_registration: &'static str,
}

pub const GATES: [GateHook; 3] = [
    GateHook {
        runtime: "claude-code",
        kit_file: ".claude/hooks/gate-enforcement.cjs",
        kit_registration: ".claude/settings.json",
        event: "PreToolUse",
        matcher: Some("Edit|Write"),
        command: "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/gate-enforcement.cjs\"",
        installed_file: ".claude/hooks/gate-enforcement.cjs",
        installed_registration: ".claude/settings.json",
    },
    GateHook {
        runtime: "codex",
        kit_file: "kit/bundles/codex/root/.codex/hooks/gate-enforcement.cjs",
        kit_registration: "kit/bundles/codex/root/.codex/hooks.json",
        event: "PreToolUse",
        matcher: Some("Edit|Write"),
        command: "node \"$(git rev-parse --show-toplevel)/.codex/hooks/gate-enforcement.cjs\"",
        installed_file: ".codex/hooks/gate-enforcement.cjs",
        installed_registration: ".codex/hooks.json",
    },
    GateHook {
        runtime: "cursor",
        kit_file: "kit/bundles/cursor/root/.cursor/hooks/gate-enforcement.cjs",
        kit_registration: "kit/bundles/cursor/root/.cursor/hooks.json",
        event: "afterFileEdit",
        matcher: None,
        command: "node .cursor/hooks/gate-enforcement.cjs",
        installed_file: ".cursor/hooks/gate-enforcement.cjs",
        installed_registration: ".cursor/hooks.json",
    },
];

/// The gate hook's own name, which a registration naming it must contain.
pub const GATE_SCRIPT_NAME: &str = "gate-enforcement.cjs";

fn read_json(path: &Path) -> Value {
    serde_json::from_slice(&std::fs::read(path).expect("read a kit json file")).expect("parse json")
}

fn write_json(path: &Path, value: &Value) {
    std::fs::write(path, serde_json::to_vec_pretty(value).expect("encode json"))
        .expect("write a kit json file");
}

/// Add `gate`'s script to `kit` and register it in that runtime's hook file.
fn plant(kit_dir: &Path, gate: &GateHook) {
    let script = kit_dir.join(gate.kit_file);
    std::fs::create_dir_all(script.parent().expect("a hooks directory"))
        .expect("create the hooks directory");
    std::fs::write(&script, GATE_SCRIPT).expect("write the gate hook");

    let registration = kit_dir.join(gate.kit_registration);
    let mut doc = read_json(&registration);
    let handler = json!({ "type": "command", "command": gate.command, "timeout": 10 });
    let event = doc["hooks"][gate.event]
        .as_array_mut()
        .expect("the event the gate registers on");
    match gate.matcher {
        // A group of its own rather than an append into an existing one: the
        // handler id is matcher plus command, so either shape records the same
        // id, and a group of one is the smaller edit.
        Some(matcher) => event.push(json!({ "matcher": matcher, "hooks": [handler] })),
        None => event.push(handler),
    }
    write_json(&registration, &doc);
}

/// The previous kit as a directory, built once per test binary.
fn gate_kit_dir() -> &'static PathBuf {
    static DIR: OnceLock<PathBuf> = OnceLock::new();
    DIR.get_or_init(|| {
        let out = Path::new(env!("CARGO_TARGET_TMPDIR")).join("gate-kit");
        let _ = std::fs::remove_dir_all(&out);
        super::copy_tree(&kit::kit().dir, &out);
        let contract = out.join(".claude/kit-contract.json");
        let mut doc = read_json(&contract);
        doc["kitVersion"] = json!(PREVIOUS_VERSION);
        write_json(&contract, &doc);
        for gate in &GATES {
            plant(&out, gate);
        }
        out
    })
}

/// `(zip, sha256)` of the previous kit, built once per test binary.
pub fn previous_archive() -> &'static (PathBuf, String) {
    static ZIP: OnceLock<(PathBuf, String)> = OnceLock::new();
    ZIP.get_or_init(|| {
        let file = Path::new(env!("CARGO_TARGET_TMPDIR")).join("gate-kit.zip");
        super::zip_tree(gate_kit_dir(), &file)
    })
}

/// `(zip, sha256)` of this checkout's kit, built once per test binary.
pub fn current_archive() -> &'static (PathBuf, String) {
    static ZIP: OnceLock<(PathBuf, String)> = OnceLock::new();
    ZIP.get_or_init(|| {
        let file = Path::new(env!("CARGO_TARGET_TMPDIR")).join("current-kit.zip");
        super::zip_tree(&kit::kit().dir, &file)
    })
}
