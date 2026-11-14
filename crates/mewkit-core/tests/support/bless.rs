//! Compare generated files with the committed ones, or rewrite them.
//!
//! The bless tests replace the maintainer scripts that regenerated these
//! artifacts through the TypeScript build. A test renders each file from Rust
//! and requires the committed bytes to match; with `MEWKIT_BLESS=1` it writes
//! the rendering instead, which is the regenerate step.

use std::fs;
use std::path::{Path, PathBuf};

use mewkit_core::maintainer::GeneratedFile;

/// The repository root, two levels above this crate.
pub fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .canonicalize()
        .expect("the repository root")
}

fn blessing() -> bool {
    std::env::var("MEWKIT_BLESS").is_ok_and(|v| v == "1")
}

/// Require every file to match its rendering; under `MEWKIT_BLESS=1` rewrite the
/// ones that differ. `problems` are failures a rewrite cannot fix (a missing
/// page) and always fail. `test` is the integration-test name for the rerun hint.
///
/// A committed file is compared with CRLF folded to LF, because a Windows
/// checkout may rewrite line endings and that is not drift.
pub fn check_or_bless(root: &Path, files: &[GeneratedFile], problems: &[String], test: &str) {
    let mut stale: Vec<&str> = Vec::new();
    for file in files {
        let path = root.join(&file.path);
        let committed = fs::read(&path)
            .map(|bytes| String::from_utf8_lossy(&bytes).replace("\r\n", "\n"))
            .ok();
        if committed.as_deref() == Some(file.content.as_str()) {
            continue;
        }
        if blessing() {
            if let Some(dir) = path.parent() {
                fs::create_dir_all(dir).expect("create the output directory");
            }
            fs::write(&path, &file.content).expect("write the generated file");
            eprintln!("blessed {}", file.path);
        } else {
            stale.push(&file.path);
        }
    }
    assert!(
        problems.is_empty(),
        "cannot be fixed by regenerating:\n  {}",
        problems.join("\n  ")
    );
    assert!(
        stale.is_empty(),
        "{} generated file(s) differ from the committed copy:\n  {}\n{}\nrerun with `MEWKIT_BLESS=1 cargo test -p mewkit-core --test {test}` and commit the result",
        stale.len(),
        stale
            .iter()
            .take(10)
            .copied()
            .collect::<Vec<_>>()
            .join("\n  "),
        if stale.len() > 10 {
            format!("  ... and {} more", stale.len() - 10)
        } else {
            String::new()
        },
    );
}
