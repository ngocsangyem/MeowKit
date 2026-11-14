//! The committed project launcher and the runtime descriptor that names it.
//!
//! Hooks stay Node scripts, and the ones that run the CLI (SessionStart
//! orientation, the agent shell's bare `mewkit`, the ship-boundary memory lint)
//! reach it through `.meowkit/bin/mewkit`, a small Node script that finds the
//! CLI and runs it. `.claude/runtime.json` records that launcher for the
//! orientation hook, which only runs an executable inside the project.
//!
//! The npm CLI writes the same launcher with `INSTALLED_BY = "node"`; this one
//! says `"native"`, so the binary is tried before a Node package. The template
//! is the npm CLI's `launcherSource()` output, and a test compares the two.
use mewkit_core::plan::{Op, Plan};
use mewkit_core::schema::runtime_descriptor::{
    RUNTIME_DESCRIPTOR_FILENAME, RUNTIME_DESCRIPTOR_SCHEMA_VERSION,
};

use crate::contract::{EmitError, EmitRequest};
use crate::kit_files::rel;

/// `.meowkit/bin/mewkit`, committed so a clone can run the CLI.
pub const LAUNCHER: &str = ".meowkit/bin/mewkit";

const TEMPLATE: &str = include_str!("launcher.cjs.tmpl");

/// The launcher's source, pinned to `version` of this binary.
pub fn source(version: &str) -> String {
    let quoted = serde_json::to_string(version).expect("a string serialises");
    TEMPLATE.replacen("\"@@VERSION@@\"", &quoted, 1)
}

/// Plan the launcher, then the descriptor that names it (project scope only).
///
/// The descriptor records the launcher's absolute path, which is what the
/// orientation hook checks for containment. `writtenAt` is left empty: the
/// descriptor is re-planned on every upgrade, and a timestamp would make each
/// dry run report a change that is not one.
pub fn push(req: &EmitRequest<'_>, plan: &mut Plan) -> Result<(), EmitError> {
    plan.ops.push(Op::WriteFile {
        path: rel(LAUNCHER)?,
        bytes: source(mewkit_core::VERSION).into_bytes(),
        mode: Some(0o755),
    });
    let executable = req.scope.root.join(LAUNCHER);
    let descriptor = serde_json::json!({
        "schemaVersion": RUNTIME_DESCRIPTOR_SCHEMA_VERSION,
        "executable": executable.to_string_lossy(),
        "packageVersion": req.kit.version,
        "writtenAt": "",
    });
    let mut bytes = serde_json::to_vec_pretty(&descriptor).expect("JSON serialises");
    bytes.push(b'\n');
    plan.ops.push(Op::WriteFile {
        path: rel(&format!(".claude/{RUNTIME_DESCRIPTOR_FILENAME}"))?,
        bytes,
        mode: None,
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_version_is_inlined_as_a_json_string_once() {
        let text = source("0.1.0");
        assert!(text.contains("const VERSION = \"0.1.0\";"));
        assert!(text.contains("const INSTALLED_BY = \"native\";"));
        assert!(!text.contains("@@VERSION@@"));
        assert!(text.starts_with("#!/usr/bin/env node\n"));
    }
}
