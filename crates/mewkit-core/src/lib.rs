//! Runtime-agnostic core of the `mewkit-next` installer.
//!
//! This crate stays a pure library — no argument parsing, no prompts, no
//! `process::exit` — so every behaviour it owns is testable without a TTY.
#![forbid(unsafe_code)]

pub mod adopt;
pub mod advice;
pub mod backup;
pub mod baseline;
pub mod budget;
pub mod capability;
pub mod config;
pub mod exec;
pub mod fsx;
pub mod journal;
pub mod js_number;
pub mod js_regex;
pub mod js_value;
pub mod kit;
pub mod layout;
pub mod lock;
pub mod mcp_profiles;
pub mod memory;
pub mod merge;
pub mod node_path;
pub mod note;
pub mod orient;
pub mod ownership;
pub mod pack_removal;
pub mod path_shape;
pub mod plan;
pub mod plan_doc;
pub mod project_root;
pub mod repo_context;
pub mod report;
pub mod review;
pub mod schema;
pub mod semver;
pub mod setup;
pub mod sidecar_lock;
pub mod skill_env;
pub mod snapshot;
pub mod state_paths;
pub mod system_deps;
pub mod task_files;
pub mod task_state;
pub mod task_store;
pub mod time_utc;
pub mod toolchain;
pub mod trace;
pub mod trace_analysis;
pub mod update;
pub mod validate;
pub mod verdict_gate;
pub mod verdict_shape;
pub mod yaml_doc;

/// Version of the workspace, shared by every crate and printed by `--version`.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg(test)]
mod tests {
    #[test]
    fn version_is_semver_shaped() {
        let parts: Vec<&str> = super::VERSION.split('.').collect();
        assert_eq!(
            parts.len(),
            3,
            "workspace version {} is not x.y.z",
            super::VERSION
        );
        assert!(parts.iter().all(|p| p.parse::<u64>().is_ok()));
    }
}
