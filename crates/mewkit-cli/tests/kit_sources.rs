//! Kit flags: a local archive fills the scope's cache, `--offline` reads it.
mod support;

use support::archive;
use support::kit::sha_tree;
use support::temp_home::TempHome;
use support::{code, text};

#[test]
fn an_archive_install_is_cached_for_offline_installs_and_uninstall() {
    let env = TempHome::new();
    let scratch = tempfile::tempdir().unwrap();
    let (zip, sha) = archive(scratch.path());
    let zip = zip.to_string_lossy().into_owned();
    let flags = ["--allow-unverified-kit"];

    let bad = env.mewkit(&[
        "init",
        "--target",
        "codex",
        "--kit-archive",
        &zip,
        "--kit-sha256",
        &"0".repeat(64),
        flags[0],
    ]);
    assert_eq!(code(&bad), 1, "a wrong checksum is refused: {}", text(&bad));
    assert!(sha_tree(&env.project()).is_empty());

    let out = env.mewkit(&[
        "init",
        "--target",
        "codex",
        "--kit-archive",
        &zip,
        "--kit-sha256",
        &sha,
        flags[0],
    ]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    let out = env.mewkit(&["init", "--target", "cursor", "--offline", flags[0]]);
    assert_eq!(code(&out), 0, "offline from the cache: {}", text(&out));

    // The cached kit corroborates removal without any kit flag.
    let out = env.mewkit(&["uninstall", "--yes"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(
        sha_tree(&env.project()).is_empty(),
        "{:?}",
        sha_tree(&env.project())
    );
}

#[test]
fn offline_with_an_empty_cache_fails_clearly() {
    let env = TempHome::new();
    let out = env.mewkit(&["init", "--target", "codex", "--offline"]);
    assert_eq!(code(&out), 1, "{}", text(&out));
    assert!(
        text(&out).to_lowercase().contains("cache"),
        "{}",
        text(&out)
    );
    assert!(sha_tree(&env.project()).is_empty());
}
