//! Shared helpers for `mewkit-cli` integration tests.
#![allow(dead_code)]
pub mod temp_home;

/// The adapters' kit builder and tree hashing, shared rather than copied.
#[path = "../../../mewkit-adapters/tests/support/mod.rs"]
pub mod kit;

use std::io::Write;
use std::path::{Path, PathBuf};

use mewkit_core::fsx::sha256_hex;
use std::process::Output;

use temp_home::TempHome;

impl TempHome {
    /// `mewkit-next` with this checkout's kit (`--kit-dir`) after `args`.
    pub fn with_kit(&self, args: &[&str]) -> Output {
        let kit = kit::kit();
        let dir = kit.dir.to_string_lossy().into_owned();
        let mut all: Vec<&str> = args.to_vec();
        all.extend(["--kit-dir", &dir, "--allow-unverified-kit"]);
        self.mewkit_next(&all)
    }

    /// Like [`TempHome::with_kit`], aborting before the `n`th disk change.
    pub fn with_kit_crashing_after(&self, n: u32, args: &[&str]) -> Output {
        let kit = kit::kit();
        self.command(env!("CARGO_BIN_EXE_mewkit-next"))
            .args(args)
            .args([
                "--kit-dir",
                &kit.dir.to_string_lossy(),
                "--allow-unverified-kit",
            ])
            .env("MEWKIT_NEXT_FAULT_AFTER", n.to_string())
            .output()
            .expect("spawn mewkit-next")
    }
}

pub fn write(root: &Path, rel: &str, text: &str) {
    let path = root.join(rel);
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(path, text).unwrap();
}

pub fn read(root: &Path, rel: &str) -> String {
    std::fs::read_to_string(root.join(rel)).unwrap()
}

/// `out`'s exit code, with its output on failure to explain an assert.
pub fn code(out: &Output) -> i32 {
    out.status.code().unwrap_or(-1)
}

pub fn text(out: &Output) -> String {
    format!(
        "{}{}",
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr)
    )
}

/// This checkout's kit as a release zip in `dir`, with its SHA-256.
pub fn archive(dir: &Path) -> (PathBuf, String) {
    let root = kit::kit().dir;
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
