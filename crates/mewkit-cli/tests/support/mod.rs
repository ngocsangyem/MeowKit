//! Shared helpers for `mewkit-cli` integration tests.
#![allow(dead_code)]
pub mod gate_kit;
pub mod gate_retire;
pub mod release;
pub mod skill_store;
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
    /// `mewkit` with this checkout's kit after `args`: as a directory
    /// (`--kit-dir`) for a project, and as a verified archive for `--global`,
    /// where a local directory needs a person at a terminal to confirm it.
    pub fn with_kit(&self, args: &[&str]) -> Output {
        let mut all: Vec<String> = args.iter().map(|a| a.to_string()).collect();
        if args.contains(&"--global") {
            // Zipped only when asked for: most tests install from the directory.
            let (zip, sha) = gate_kit::current_archive();
            all.extend([
                "--kit-archive".into(),
                zip.to_string_lossy().into_owned(),
                "--kit-sha256".into(),
                sha.clone(),
            ]);
        } else {
            all.extend([
                "--kit-dir".into(),
                kit::kit().dir.to_string_lossy().into_owned(),
                "--allow-unverified-kit".into(),
            ]);
        }
        let all: Vec<&str> = all.iter().map(String::as_str).collect();
        self.mewkit(&all)
    }

    /// Like [`TempHome::with_kit`], aborting before the `n`th disk change.
    pub fn with_kit_crashing_after(&self, n: u32, args: &[&str]) -> Output {
        let kit = kit::kit();
        self.command(env!("CARGO_BIN_EXE_mewkit"))
            .args(args)
            .args([
                "--kit-dir",
                &kit.dir.to_string_lossy(),
                "--allow-unverified-kit",
            ])
            .env("MEWKIT_NEXT_FAULT_AFTER", n.to_string())
            .output()
            .expect("spawn mewkit")
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

/// Copy every file under `source` into `dest`, creating directories as needed.
pub fn copy_tree(source: &Path, dest: &Path) {
    std::fs::create_dir_all(dest).expect("create a directory");
    for entry in std::fs::read_dir(source).expect("read a directory") {
        let entry = entry.expect("a directory entry");
        let target = dest.join(entry.file_name());
        if entry.path().is_dir() {
            copy_tree(&entry.path(), &target);
        } else {
            std::fs::copy(entry.path(), &target).expect("copy a file");
        }
    }
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
    zip_tree(&kit::kit().dir, &dir.join("meowkit-release.zip"))
}

/// Every file under `root` as a release zip at `file`, with the zip's SHA-256.
pub fn zip_tree(root: &Path, file: &Path) -> (PathBuf, String) {
    let mut zip = zip::ZipWriter::new(std::fs::File::create(file).unwrap());
    let opts = zip::write::SimpleFileOptions::default();
    let mut todo = vec![root.to_path_buf()];
    while let Some(d) = todo.pop() {
        for entry in std::fs::read_dir(&d).unwrap() {
            let path = entry.unwrap().path();
            if path.is_dir() {
                todo.push(path);
                continue;
            }
            let name = path
                .strip_prefix(root)
                .unwrap()
                .to_string_lossy()
                .replace('\\', "/");
            zip.start_file(name, opts).unwrap();
            zip.write_all(&std::fs::read(&path).unwrap()).unwrap();
        }
    }
    zip.finish().unwrap();
    let sha = sha256_hex(&std::fs::read(file).unwrap());
    (file.to_path_buf(), sha)
}
