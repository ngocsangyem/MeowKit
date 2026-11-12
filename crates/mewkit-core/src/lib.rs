//! Runtime-agnostic core of the `mewkit-next` installer.
//!
//! This crate stays a pure library — no argument parsing, no prompts, no
//! `process::exit` — so every behaviour it owns is testable without a TTY.
#![forbid(unsafe_code)]

pub mod adopt;
pub mod backup;
pub mod config;
pub mod exec;
pub mod fsx;
pub mod journal;
pub mod js_number;
pub mod js_regex;
pub mod kit;
pub mod layout;
pub mod lock;
pub mod memory;
pub mod merge;
pub mod ownership;
pub mod path_shape;
pub mod plan;
pub mod report;
pub mod schema;
pub mod semver;
pub mod state_paths;
pub mod update;
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
