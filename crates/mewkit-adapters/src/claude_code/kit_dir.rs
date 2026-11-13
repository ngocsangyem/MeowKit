//! What a Claude Code install keeps under `.meowkit/` besides state, and the
//! plugin envelope.
//!
//! The kit ships the pack manifest, the governance registry and the example
//! files; the deny-all ignore file and the config stub are generated. All of
//! them are templates a project edits, so they are ordinary written files: a
//! user edit is kept, never overwritten. State, caches and the ownership index
//! are the lifecycle commands' own and are not written here.
use mewkit_core::config::{observer_names, render_config_stub};
use mewkit_core::plan::{Op, Plan};

use crate::contract::{EmitError, EmitRequest};
use crate::kit_files::{self, rel};

/// The `.meowkit/` members the kit ships and a project keeps.
const SHIPPED: [&str; 5] = [
    ".env.example",
    "gitignore.meowkit",
    "mcp.json.example",
    "pack-manifest.json",
    "harness-inventory.json",
];

/// Deny everything under `.meowkit/`, then re-include what a team shares. A
/// new machine-written class stays ignored until someone decides to share it,
/// which fails in the safe direction: the local kit copy and the ownership
/// index can never be committed by accident.
pub const GITIGNORE: &str = "*\n!.gitignore\n!config.yaml\n!.env.example\n!mcp.json.example\n!bin/\n!bin/mewkit\n!memory/\n!memory/*.md\n";

pub const PLUGIN_MANIFEST: &str = ".claude-plugin/plugin.json";

pub fn push_shared(req: &EmitRequest<'_>, plan: &mut Plan) -> Result<(), EmitError> {
    let from = req.kit.dir.join(".meowkit");
    for name in SHIPPED {
        let src = from.join(name);
        if src.is_file() {
            plan.ops.push(Op::WriteFile {
                path: rel(&format!(".meowkit/{name}"))?,
                bytes: kit_files::read(&src)?,
                mode: None,
            });
        }
    }
    plan.ops.push(Op::WriteFile {
        path: rel(".meowkit/.gitignore")?,
        bytes: GITIGNORE.as_bytes().to_vec(),
        mode: None,
    });
    plan.ops.push(Op::WriteFile {
        path: rel(".meowkit/config.yaml")?,
        bytes: render_config_stub(&observer_names(&req.kit.dir), &Default::default()).into_bytes(),
        mode: None,
    });
    Ok(())
}

/// The plugin envelope: one metadata file. It names no component path,
/// because the manifest's `agents` and `commands` keys would replace the
/// host's own directory scan with a list that has to be kept correct, and the
/// kit already lays its content down in the standard places.
pub fn plugin_manifest(kit_version: &str) -> Result<Op, EmitError> {
    let manifest = serde_json::json!({
        "name": "meowkit",
        "displayName": "MeowKit",
        "description": "MeowKit workflow kit for Claude Code. Same SessionStart hook, propagated into the plugin payload at plugin generation; plugin hooks gate behavior.",
        "version": kit_version,
        "license": "MIT",
        "keywords": ["workflow", "agents", "skills"],
        "homepage": "https://github.com/ngocsangyem/MeowKit",
        "repository": "https://github.com/ngocsangyem/MeowKit",
    });
    let mut text = serde_json::to_string_pretty(&manifest)
        .map_err(|e| EmitError::Kit(format!("plugin manifest: {e}")))?;
    text.push('\n');
    Ok(Op::WriteFile {
        path: rel(PLUGIN_MANIFEST)?,
        bytes: text.into_bytes(),
        mode: None,
    })
}
