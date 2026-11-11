//! Kit flags: a local archive fills the scope's cache, `--offline` reads it.
mod support;

use std::io::Write;
use std::path::{Path, PathBuf};

use mewkit_core::fsx::sha256_hex;
use support::kit::{kit, sha_tree};
use support::temp_home::TempHome;
use support::{code, text};

/// This checkout's kit as a release zip in `dir`, with its SHA-256.
fn archive(dir: &Path) -> (PathBuf, String) {
    let root = kit().dir;
    let file = dir.join("meowkit-release.zip");
    let mut zip = zip::ZipWriter::new(std::fs::File::create(&file).unwrap());
    let opts = zip::write::SimpleFileOptions::default();
    let mut todo = vec![root.clone()];
    while let Some(d) = todo.pop() {
        for entry in std::fs::read_dir(&d).unwrap() {
            let path = entry.unwrap().path();
            if path.is_dir() {
                todo.push(path);
                continue;
            }
            let name = path
                .strip_prefix(&root)
                .unwrap()
                .to_string_lossy()
                .replace('\\', "/");
            zip.start_file(name, opts).unwrap();
            zip.write_all(&std::fs::read(&path).unwrap()).unwrap();
        }
    }
    zip.finish().unwrap();
    let sha = sha256_hex(&std::fs::read(&file).unwrap());
    (file, sha)
}

#[test]
fn an_archive_install_is_cached_for_offline_installs_and_uninstall() {
    let env = TempHome::new();
    let scratch = tempfile::tempdir().unwrap();
    let (zip, sha) = archive(scratch.path());
    let zip = zip.to_string_lossy().into_owned();
    let flags = ["--allow-unverified-kit"];

    let bad = env.mewkit_next(&[
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

    let out = env.mewkit_next(&[
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
    let out = env.mewkit_next(&["init", "--target", "cursor", "--offline", flags[0]]);
    assert_eq!(code(&out), 0, "offline from the cache: {}", text(&out));

    // The cached kit corroborates removal without any kit flag.
    let out = env.mewkit_next(&["uninstall", "--yes"]);
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
    let out = env.mewkit_next(&["init", "--target", "codex", "--offline"]);
    assert_eq!(code(&out), 1, "{}", text(&out));
    assert!(
        text(&out).to_lowercase().contains("cache"),
        "{}",
        text(&out)
    );
    assert!(sha_tree(&env.project()).is_empty());
}
