//! Extract a kit zip into a fresh directory, refusing anything unsafe.
//!
//! Every member name must be a plain relative path (no absolute paths, `..`,
//! backslashes or drive letters); symlink members, duplicate names and archives
//! past the size or entry limits are refused before anything is written.
use std::collections::HashSet;
use std::io::{Cursor, Read};
use std::path::Path;

use super::KitError;
use crate::fsx::RelPath;

pub const MAX_ENTRIES: usize = 20_000;
pub const MAX_FILE_BYTES: u64 = 64 * 1024 * 1024;
pub const MAX_TOTAL_BYTES: u64 = 512 * 1024 * 1024;

/// Unpack `zip` into `dest`, which must be an empty directory the caller owns.
pub fn extract(zip: &[u8], dest: &Path) -> Result<usize, KitError> {
    let mut archive = zip::ZipArchive::new(Cursor::new(zip))
        .map_err(|e| unsafe_zip(format!("not a zip: {e}")))?;
    if archive.len() > MAX_ENTRIES {
        return Err(unsafe_zip(format!(
            "{} entries exceeds the {MAX_ENTRIES} limit",
            archive.len()
        )));
    }
    let mut seen = HashSet::new();
    let mut total = 0u64;
    let mut files = 0;
    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| unsafe_zip(format!("entry {i}: {e}")))?;
        let raw = entry
            .name()
            .map_err(|e| unsafe_zip(format!("entry {i} has an unreadable name: {e}")))?
            .into_owned();
        if entry.is_symlink() {
            return Err(unsafe_zip(format!("{raw} is a symlink")));
        }
        let rel = RelPath::new(raw.trim_end_matches('/'))
            .ok()
            .filter(|_| entry.enclosed_name().is_some())
            .ok_or_else(|| unsafe_zip(format!("{raw:?} is not a safe relative path")))?;
        if !seen.insert(rel.as_str().to_owned()) {
            return Err(unsafe_zip(format!("{rel} appears twice")));
        }
        let target = rel.under(dest);
        if entry.is_dir() {
            std::fs::create_dir_all(&target).map_err(io(&rel))?;
            continue;
        }
        if entry.size() > MAX_FILE_BYTES {
            return Err(unsafe_zip(format!(
                "{rel} is larger than {MAX_FILE_BYTES} bytes"
            )));
        }
        // The declared size can lie; cap what is actually read as well.
        let mut bytes = Vec::new();
        entry
            .by_ref()
            .take(MAX_FILE_BYTES + 1)
            .read_to_end(&mut bytes)
            .map_err(|e| unsafe_zip(format!("{rel}: {e}")))?;
        total += bytes.len() as u64;
        if bytes.len() as u64 > MAX_FILE_BYTES || total > MAX_TOTAL_BYTES {
            return Err(unsafe_zip(format!(
                "{rel} pushes the archive past its size limit"
            )));
        }
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent).map_err(io(&rel))?;
        }
        std::fs::write(&target, &bytes).map_err(io(&rel))?;
        set_mode(&target, entry.unix_mode()).map_err(io(&rel))?;
        files += 1;
    }
    Ok(files)
}

/// Keep the executable bit from the archive; everything else is 0644.
#[cfg(unix)]
fn set_mode(path: &Path, mode: Option<u32>) -> std::io::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    let exec = mode.is_some_and(|m| m & 0o111 != 0);
    std::fs::set_permissions(
        path,
        std::fs::Permissions::from_mode(if exec { 0o755 } else { 0o644 }),
    )
}

#[cfg(not(unix))]
fn set_mode(_: &Path, _: Option<u32>) -> std::io::Result<()> {
    Ok(())
}

fn unsafe_zip(msg: String) -> KitError {
    KitError::Unsafe(msg)
}

fn io(rel: &RelPath) -> impl FnOnce(std::io::Error) -> KitError + '_ {
    move |source| KitError::Io {
        action: format!("extracting {rel}"),
        source,
    }
}
