//! The declared key surface and the fixture corpus cannot drift apart.
//!
//! Separate from `config_loader.rs`, which is about what the LOADER does with a
//! fixture; these are about whether a fixture exists for every entry in a table
//! the loader refuses by name.
use std::fs;
use std::path::{Path, PathBuf};

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("..").join("..")
}

fn fixtures_dir() -> PathBuf {
    repo_root().join("tests").join("config").join("fixtures")
}

fn fixture_files() -> Vec<String> {
    let mut files: Vec<String> = fs::read_dir(fixtures_dir())
        .expect("the committed fixture corpus")
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.file_name().to_string_lossy().to_string())
        .filter(|name| name.ends_with(".yaml"))
        .collect();
    files.sort();
    files
}

#[test]
fn every_protected_hook_has_a_fixture_naming_it() {
    // The TypeScript derives its 7 `protected-hook` expectations from
    // PROTECTED_HOOKS in a loop, so an 8th protected hook added without a
    // fixture fails there. The Rust table hardcodes the 7 fixture names, so it
    // did not. This closes that asymmetry: the LIST is the source, the fixtures
    // have to cover it.
    let sources: Vec<String> = fixture_files()
        .into_iter()
        .filter(|name| name.starts_with("reject-protected-"))
        .map(|name| fs::read_to_string(fixtures_dir().join(name)).unwrap_or_default())
        .collect();
    for (hook, _) in mewkit_core::config::schema::PROTECTED_HOOKS {
        assert!(
            sources.iter().any(|source| source.contains(hook)),
            "no reject-protected-* fixture disables {hook}"
        );
    }
}
