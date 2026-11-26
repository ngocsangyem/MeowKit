//! The committed project launcher.
//!
//! Hooks stay Node scripts, and the ones that run the CLI (SessionStart
//! orientation, the agent shell's bare `mewkit`, the ship-boundary memory lint)
//! reach it through `.meowkit/bin/mewkit`, a small Node script that finds the
//! CLI and runs it. Each hook resolves that project-relative path and runs it
//! only when it stays inside the project.
//!
//! The npm CLI writes the same launcher with `INSTALLED_BY = "node"`; this one
//! says `"native"`, so the binary is tried before a Node package. The template
//! is the npm CLI's `launcherSource()` output, and a test compares the two.
use mewkit_core::plan::{Op, Plan};

use crate::contract::EmitError;
use crate::kit_files::rel;

/// `.meowkit/bin/mewkit`, committed so a clone can run the CLI.
pub const LAUNCHER: &str = ".meowkit/bin/mewkit";

/// The descriptor earlier installs wrote beside the launcher. Nothing reads it
/// any more: the hooks find the launcher by its project path.
pub const LEGACY_DESCRIPTOR: &str = ".claude/runtime.json";

const TEMPLATE: &str = include_str!("launcher.cjs.tmpl");

/// The launcher's source, pinned to `version` of this binary.
pub fn source(version: &str) -> String {
    let quoted = serde_json::to_string(version).expect("a string serialises");
    TEMPLATE.replacen("\"@@VERSION@@\"", &quoted, 1)
}

/// Plan the launcher (project scope only).
pub fn push(plan: &mut Plan) -> Result<(), EmitError> {
    plan.ops.push(Op::WriteFile {
        path: rel(LAUNCHER)?,
        bytes: source(mewkit_core::VERSION).into_bytes(),
        mode: Some(0o755),
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
