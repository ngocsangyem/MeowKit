//! The binary's other names beside it: `mk` (the short name) and `mewkit-next` (the
//! pre-rename name, kept for one release). The installer places them; after a
//! self-update they must run the new binary too, or `mk` would silently stay old.
//!
//! On Unix each name is a symlink to the binary, so a symlink already resolving to it
//! is left alone, and an older mewkit copy is swapped for a symlink. On Windows each
//! name is a copy and is replaced with the new bytes. A name that does not exist is
//! only created when the running file is itself `mewkit-next`: that install predates
//! the rename and should land on the new names.
//!
//! An existing name is only replaced when it is a mewkit binary (`--version` prints
//! `mewkit …`): a `mk` from another tool, the npm CLI's `mewkit` shim or a directory
//! is left as it is and reported.
use std::io;
use std::path::Path;

/// Every name the binary is installed under.
const NAMES: [&str; 3] = ["mewkit", "mk", "mewkit-next"];

/// What happened to the names beside the binary.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct Refreshed {
    /// Names placed or refreshed, as file names.
    pub placed: Vec<String>,
    /// One line per name left unplaced; the binary itself is already updated.
    pub problems: Vec<String>,
}

/// Make every other name beside the binary at `exe` run it.
pub fn refresh(exe: &Path) -> Refreshed {
    let mut out = Refreshed::default();
    // Invoked through a link (`mk`), `exe` may be that link: work from the real file so
    // the link itself is never mistaken for the binary.
    let Ok(exe) = exe.canonicalize() else {
        return out;
    };
    let exe = exe.as_path();
    let (Some(dir), Some(own)) = (exe.parent(), exe.file_name()) else {
        return out;
    };
    let suffix = std::env::consts::EXE_SUFFIX;
    let legacy = own.to_str() == Some(&*format!("mewkit-next{suffix}"));
    for name in NAMES {
        let file = format!("{name}{suffix}");
        if own.to_str() == Some(file.as_str()) {
            continue;
        }
        let path = dir.join(&file);
        let Ok(meta) = path.symlink_metadata() else {
            if legacy {
                record(&mut out, &file, &path, place(exe, &path));
            }
            continue;
        };
        if path.canonicalize().is_ok_and(|real| real == exe) {
            continue;
        }
        if meta.is_dir() || !is_mewkit(&path) {
            out.problems.push(format!(
                "{} is not a mewkit binary; left as it is",
                path.display()
            ));
            continue;
        }
        record(&mut out, &file, &path, place(exe, &path));
    }
    out
}

fn record(out: &mut Refreshed, file: &str, path: &Path, result: io::Result<()>) {
    match result {
        Ok(()) => out.placed.push(file.to_owned()),
        Err(e) => out
            .problems
            .push(format!("could not place {}: {e}", path.display())),
    }
}

/// Whether `path` runs a mewkit binary: its version banner is `mewkit X` (or the
/// pre-rename `mewkit-next X`). The npm CLI prints a bare version, so its shim fails.
fn is_mewkit(path: &Path) -> bool {
    std::process::Command::new(path)
        .arg("--version")
        .stdin(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .output()
        .is_ok_and(|o| {
            let banner = String::from_utf8_lossy(&o.stdout);
            o.status.success()
                && (banner.starts_with("mewkit ") || banner.starts_with("mewkit-next "))
        })
}

#[cfg(unix)]
fn place(exe: &Path, path: &Path) -> io::Result<()> {
    let target = exe.file_name().expect("exe has a file name");
    // Link under a temporary name, then rename over the old copy: the name never goes
    // missing, so a concurrent `mk` either runs the old copy or the new link.
    let mut staged = path.as_os_str().to_owned();
    staged.push(".mewkit-link");
    let staged = std::path::PathBuf::from(staged);
    let _ = std::fs::remove_file(&staged);
    std::os::unix::fs::symlink(target, &staged)?;
    std::fs::rename(&staged, path).inspect_err(|_| {
        let _ = std::fs::remove_file(&staged);
    })
}

#[cfg(not(unix))]
fn place(exe: &Path, path: &Path) -> io::Result<()> {
    let bytes = std::fs::read(exe)?;
    if path.exists() {
        // A copy may be running; `replace` renames it aside first, as for the binary.
        super::replace::replace(path, &bytes).map(drop)
    } else {
        std::fs::write(path, &bytes)
    }
}

#[cfg(test)]
#[path = "aliases_tests.rs"]
mod tests;
