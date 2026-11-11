//! Put a new binary in place of the running one, keeping the old one beside
//! it as `<name>.old` for rollback.
//!
//! The new binary is written next to the target first, so placing it is a
//! rename within one directory. On Unix that rename goes straight over the
//! running binary (the process keeps its open file), after the old one is
//! hard-linked (or copied) to `.old`: the path never goes missing. Windows
//! refuses to overwrite a running `.exe` but lets it be renamed, so there the
//! old binary is renamed aside first and put back if placing the new one fails.
use std::io;
use std::path::{Path, PathBuf};

/// Replace `exe` with `bytes`. Returns where the previous binary was kept.
/// On error the message says whether anything changed.
pub fn replace(exe: &Path, bytes: &[u8]) -> io::Result<PathBuf> {
    let unchanged = |e: io::Error| io::Error::new(e.kind(), format!("{e}; nothing was changed"));
    let dir = exe
        .parent()
        .ok_or_else(|| io::Error::other(format!("{} has no directory", exe.display())))?;
    let name = exe
        .file_name()
        .ok_or_else(|| io::Error::other(format!("{} has no file name", exe.display())))?;
    let mut staged = tempfile::Builder::new()
        .prefix(".mewkit-next-update-")
        .tempfile_in(dir)
        .map_err(unchanged)?;
    io::Write::write_all(&mut staged, bytes).map_err(unchanged)?;
    staged.as_file().sync_all().map_err(unchanged)?;
    std::fs::set_permissions(staged.path(), std::fs::metadata(exe)?.permissions())
        .map_err(unchanged)?;

    let mut old = name.to_owned();
    old.push(".old");
    let old = dir.join(old);
    match std::fs::remove_file(&old) {
        Err(e) if e.kind() != io::ErrorKind::NotFound => {
            return Err(io::Error::new(
                e.kind(),
                format!(
                    "cannot remove the previous {} ({e}); a copy of it may still be running. \
                     Close it and run again; nothing was changed",
                    old.display()
                ),
            ));
        }
        _ => {}
    }
    place(exe, &old, staged)?;
    Ok(old)
}

#[cfg(unix)]
fn place(exe: &Path, old: &Path, staged: tempfile::NamedTempFile) -> io::Result<()> {
    if std::fs::hard_link(exe, old).is_err() {
        std::fs::copy(exe, old)
            .map_err(|e| io::Error::new(e.kind(), format!("{e}; nothing was changed")))?;
    }
    staged.persist(exe).map(drop).map_err(|e| {
        io::Error::new(
            e.error.kind(),
            format!(
                "could not place the new binary ({}); nothing was changed",
                e.error
            ),
        )
    })
}

#[cfg(not(unix))]
fn place(exe: &Path, old: &Path, staged: tempfile::NamedTempFile) -> io::Result<()> {
    std::fs::rename(exe, old)
        .map_err(|e| io::Error::new(e.kind(), format!("{e}; nothing was changed")))?;
    staged.persist(exe).map(drop).map_err(|e| {
        let detail = match std::fs::rename(old, exe) {
            Ok(()) => "; nothing was changed".to_owned(),
            Err(b) => format!(
                "; restoring the old binary also failed ({b}): move {} back to {}",
                old.display(),
                exe.display()
            ),
        };
        io::Error::new(
            e.error.kind(),
            format!("could not place the new binary ({}){detail}", e.error),
        )
    })
}
