//! Per-runtime adapters for the `mewkit-next` installer.
//!
//! Each runtime the kit installs into gets one adapter here, built on
//! `mewkit-core`; none exists yet.
#![forbid(unsafe_code)]

/// The runtimes an adapter will exist for, by their `--target` names.
pub const TARGETS: [&str; 3] = ["claude-code", "codex", "cursor"];

#[cfg(test)]
mod tests {
    #[test]
    fn target_names_are_unique() {
        let mut names = super::TARGETS.to_vec();
        names.sort_unstable();
        names.dedup();
        assert_eq!(names.len(), super::TARGETS.len());
    }
}
