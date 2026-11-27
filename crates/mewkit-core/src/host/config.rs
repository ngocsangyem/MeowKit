//! The three machine-wide `host.*` settings, read only from the user config
//! (`~/.meowkit/config.yaml`). A project file cannot set them: the rules
//! refuse `host.*` there, because the watcher and the queue are shared by
//! every project on the machine.
use std::path::Path;

use crate::config::{ConfigScope, ConfigValue, load_config_file, user_config_path};

/// Upper bound for `host.max_heavy`: more parallel heavy jobs than this
/// defeats the point of admission on any laptop.
pub const MAX_HEAVY_CAP: i64 = 8;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct HostConfig {
    pub enabled: bool,
    pub auto_clean: bool,
    /// Slots under a `go` verdict, already clamped to 1–8.
    pub max_heavy: u8,
}

/// Default slots: a quarter of the logical cores, at least 1, at most 4.
pub fn default_max_heavy(logical_cores: usize) -> u8 {
    (logical_cores / 4).clamp(1, 4) as u8
}

impl HostConfig {
    pub fn defaults(logical_cores: usize) -> Self {
        Self {
            enabled: true,
            auto_clean: true,
            max_heavy: default_max_heavy(logical_cores),
        }
    }

    /// The user config's values over the defaults. An unreadable or invalid
    /// file yields the defaults: host admission fails open.
    pub fn load(home: &Path, logical_cores: usize) -> Self {
        let mut config = Self::defaults(logical_cores);
        let Ok(loaded) = load_config_file(&user_config_path(home), &[], ConfigScope::UserConfig) else {
            return config;
        };
        if let Some(ConfigValue::Bool(b)) = loaded.values.get("host.enabled") {
            config.enabled = *b;
        }
        if let Some(ConfigValue::Bool(b)) = loaded.values.get("host.auto_clean") {
            config.auto_clean = *b;
        }
        if let Some(ConfigValue::Int(n)) = loaded.values.get("host.max_heavy") {
            config.max_heavy = (*n).clamp(1, MAX_HEAVY_CAP) as u8;
        }
        config
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn home_with(yaml: &str) -> tempfile::TempDir {
        let home = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(home.path().join(".meowkit")).unwrap();
        std::fs::write(home.path().join(".meowkit/config.yaml"), yaml).unwrap();
        home
    }

    #[test]
    fn defaults_scale_with_cores_within_one_to_four() {
        assert_eq!(default_max_heavy(2), 1);
        assert_eq!(default_max_heavy(8), 2);
        assert_eq!(default_max_heavy(64), 4);
        let empty = tempfile::tempdir().unwrap();
        assert_eq!(HostConfig::load(empty.path(), 8), HostConfig::defaults(8));
    }

    #[test]
    fn user_values_apply_and_max_heavy_is_clamped() {
        let home = home_with("host:\n  enabled: false\n  auto_clean: false\n  max_heavy: 50\n");
        let c = HostConfig::load(home.path(), 8);
        assert_eq!((c.enabled, c.auto_clean, c.max_heavy), (false, false, 8));
        let home = home_with("host:\n  max_heavy: 0\n");
        assert_eq!(HostConfig::load(home.path(), 8).max_heavy, 1);
    }

    #[test]
    fn an_invalid_user_config_falls_back_to_defaults() {
        let home = home_with("host:\n  max_heavy: lots\n");
        assert_eq!(HostConfig::load(home.path(), 8), HostConfig::defaults(8));
    }
}
