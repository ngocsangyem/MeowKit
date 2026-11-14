//! Fixtures in, file trees out.
//!
//! ## Why fixture dot-directories are written with a leading underscore
//!
//! A fixture needs to ship `.git/HEAD` (to pin a revision a probe reads) and
//! `.meowkit/state/active-plan.json` (to pin a pointer). Git tracks neither:
//! it refuses a path named `.git` outright, and this repo's `.gitignore` ignores
//! `.meowkit/state/` everywhere. So a fixture stores those segments with a
//! LEADING UNDERSCORE — `_git/HEAD`, `_meowkit/state/active-plan.json` — and the
//! copy below turns a leading `_` back into a `.` on every segment. No fixture
//! file legitimately starts with an underscore.
//!
//! ## The one placeholder
//!
//! A durable record can name an ABSOLUTE path (a repo identity), which a
//! fixture cannot know: it is the temp directory the case happens to run in.
//! `{{PROJECT}}` in any UTF-8 fixture file is replaced with the destination
//! project root, with backslashes doubled so the result is valid inside the JSON
//! every such fixture is written in.
use std::path::Path;

use super::normalise::Normaliser;

/// Copy `tests/npm_behaviour/fixtures/<name>/` into `dest`, restoring dot-prefixes.
pub fn copy_fixture(name: &str, dest: &Path) {
    let source = fixtures_dir().join(name);
    assert!(source.is_dir(), "no fixture at {}", source.display());
    let project = dest.to_string_lossy().replace('\\', "\\\\");
    copy_tree(&source, dest, &project);
}

fn copy_tree(source: &Path, dest: &Path, project: &str) {
    std::fs::create_dir_all(dest).expect("create a fixture directory");
    for entry in std::fs::read_dir(source).expect("read a fixture directory") {
        let entry = entry.expect("a fixture directory entry");
        let name = entry.file_name().to_string_lossy().into_owned();
        let target = dest.join(undot(&name));
        if entry.path().is_dir() {
            copy_tree(&entry.path(), &target, project);
            continue;
        }
        let bytes = std::fs::read(entry.path()).expect("read a fixture file");
        match String::from_utf8(bytes) {
            Ok(text) if text.contains("{{PROJECT}}") => {
                std::fs::write(&target, text.replace("{{PROJECT}}", project))
            }
            Ok(text) => std::fs::write(&target, text),
            Err(e) => std::fs::write(&target, e.as_bytes()),
        }
        .expect("write a fixture file");
        copy_mode(&entry.path(), &target);
    }
}

/// A fixture file's MODE is content for one check: `validate` asks whether a
/// hook is EXECUTABLE, so a copy that dropped the bit would make every
/// fixture's hooks fail and no fixture could express a healthy install.
#[cfg(unix)]
fn copy_mode(source: &Path, target: &Path) {
    use std::os::unix::fs::PermissionsExt;
    if let Ok(metadata) = std::fs::metadata(source) {
        let mode = metadata.permissions().mode();
        let _ = std::fs::set_permissions(target, std::fs::Permissions::from_mode(mode));
    }
}

/// Windows has no POSIX mode to carry, and no check reads one there.
#[cfg(not(unix))]
fn copy_mode(_source: &Path, _target: &Path) {}

/// `_git` → `.git`. A `.gitkeep` inside a fixture is how an otherwise empty
/// directory survives being committed; it is copied like any other file,
/// because a command that trips over a stray file is worth knowing about.
fn undot(name: &str) -> String {
    match name.strip_prefix('_') {
        Some(rest) => format!(".{rest}"),
        None => name.to_string(),
    }
}

/// Every file under a project root: the relative path, and the bytes as text
/// when they are UTF-8 (normalised), else a byte-length marker.
pub struct Tree {
    entries: Vec<(String, String)>,
}

impl Tree {
    fn sorted(mut entries: Vec<(String, String)>) -> Self {
        entries.sort_by(|a, b| a.0.cmp(&b.0));
        Self { entries }
    }

    pub fn paths(&self) -> Vec<&str> {
        self.entries.iter().map(|(p, _)| p.as_str()).collect()
    }

    pub fn entries(&self) -> impl Iterator<Item = (&str, &str)> {
        self.entries.iter().map(|(p, b)| (p.as_str(), b.as_str()))
    }

    pub fn get(&self, path: &str) -> &str {
        self.entries
            .iter()
            .find(|(p, _)| p == path)
            .map(|(_, b)| b.as_str())
            .unwrap_or("<absent>")
    }
}

/// Snapshot what a run left on disk, with the same normaliser the streams use —
/// a timestamp inside a written record is as unshareable as one on stdout.
pub fn snapshot(root: &Path, normaliser: &mut Normaliser) -> Tree {
    Tree::sorted(
        files_as_text(root)
            .into_iter()
            .map(|(path, text)| (normaliser.path(&path), normaliser.text(&text)))
            .collect(),
    )
}

/// A frozen tree (see `golden.rs`), put through the same normaliser as a live one.
pub fn frozen_tree(files: &[(String, String)], normaliser: &mut Normaliser) -> Tree {
    Tree::sorted(
        files
            .iter()
            .map(|(path, text)| (normaliser.path(path), normaliser.text(text)))
            .collect(),
    )
}

/// Every file under `root` as `(relative path, text)`, sorted by path.
pub fn files_as_text(root: &Path) -> Vec<(String, String)> {
    let mut entries = Vec::new();
    collect(root, root, &mut entries);
    entries.sort_by(|a, b| a.0.cmp(&b.0));
    entries
        .into_iter()
        .map(|(path, bytes)| {
            let text = match String::from_utf8(bytes) {
                Ok(text) => text,
                // A binary artifact (a rotated, gzipped log) compares by size:
                // two gzip streams of the same bytes are not byte-identical
                // across implementations, and the content was already compared
                // before it rotated.
                Err(e) => format!("<{} non-utf8 bytes>", e.as_bytes().len()),
            };
            (path, text)
        })
        .collect()
}

fn collect(root: &Path, dir: &Path, out: &mut Vec<(String, Vec<u8>)>) {
    let Ok(read) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in read.filter_map(Result::ok) {
        let path = entry.path();
        if path.is_dir() {
            collect(root, &path, out);
            continue;
        }
        let rel = path
            .strip_prefix(root)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");
        out.push((rel, std::fs::read(&path).unwrap_or_default()));
    }
}

pub fn repo_root() -> std::path::PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .canonicalize()
        .expect("the repo root resolves from the crate manifest")
}

pub fn fixtures_dir() -> std::path::PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("npm_behaviour")
        .join("fixtures")
}
