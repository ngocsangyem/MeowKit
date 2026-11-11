//! Reading files out of an extracted kit directory.
use std::path::{Path, PathBuf};

use crate::contract::{EmitError, RelPath};

/// One regular file under a kit subtree.
pub struct KitFile {
    /// Path relative to the subtree root, `/`-separated.
    pub rel: String,
    pub abs: PathBuf,
}

/// Every regular file under `root`, sorted by relative path so plans are
/// deterministic. Symlinks are skipped: kit extraction refuses them, so one
/// here means the directory did not come from a kit archive.
pub fn walk(root: &Path) -> Result<Vec<KitFile>, EmitError> {
    let mut out = Vec::new();
    walk_into(root, "", &mut out)?;
    out.sort_by(|a, b| a.rel.cmp(&b.rel));
    Ok(out)
}

fn walk_into(dir: &Path, prefix: &str, out: &mut Vec<KitFile>) -> Result<(), EmitError> {
    let entries = std::fs::read_dir(dir).map_err(|e| io_err(dir, e))?;
    for entry in entries {
        let entry = entry.map_err(|e| io_err(dir, e))?;
        let name = entry.file_name().into_string().map_err(|n| {
            EmitError::Kit(format!("non-UTF-8 file name {n:?} in {}", dir.display()))
        })?;
        let rel = if prefix.is_empty() {
            name
        } else {
            format!("{prefix}/{name}")
        };
        let kind = entry.file_type().map_err(|e| io_err(&entry.path(), e))?;
        if kind.is_dir() {
            walk_into(&entry.path(), &rel, out)?;
        } else if kind.is_file() {
            out.push(KitFile {
                rel,
                abs: entry.path(),
            });
        }
    }
    Ok(())
}

pub fn read(path: &Path) -> Result<Vec<u8>, EmitError> {
    std::fs::read(path).map_err(|e| io_err(path, e))
}

pub fn read_text(path: &Path) -> Result<String, EmitError> {
    String::from_utf8(read(path)?)
        .map_err(|_| EmitError::Kit(format!("{} is not UTF-8", path.display())))
}

/// `Some(0o755)` for a kit file with an execute bit, else `None` (0644).
pub fn mode(path: &Path) -> Option<u32> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let m = std::fs::metadata(path).ok()?.permissions().mode();
        (m & 0o111 != 0).then_some(0o755)
    }
    #[cfg(not(unix))]
    {
        let _ = path;
        None
    }
}

pub fn rel(s: &str) -> Result<RelPath, EmitError> {
    RelPath::new(s).map_err(|e| EmitError::Kit(format!("{s}: {e}")))
}

fn io_err(path: &Path, e: std::io::Error) -> EmitError {
    EmitError::Kit(format!("{}: {e}", path.display()))
}
