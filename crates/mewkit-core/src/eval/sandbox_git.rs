//! A git repository for a `gitInit` case: the fixture copy gets one commit, and
//! the run's empty home gets a throwaway identity. Every git call here reads a
//! private config file, so the user's own hooks, signing or aliases never apply.

use std::fs;
use std::io;
use std::path::Path;

use super::sandbox::copy_tree;

/// Fixture folder whose contents land in the project only after the initial
/// commit, so a `gitInit` case can start with uncommitted changes.
pub const UNCOMMITTED_DIR: &str = ".eval-uncommitted";

/// Identity and settings for every git command in a sandbox: the run's `HOME`
/// is empty, and a user's own config (hooks, signing) must not leak in.
const GIT_IDENTITY: &str = "[user]\n\tname = eval\n\temail = eval@example.invalid\n[commit]\n\tgpgsign = false\n[init]\n\tdefaultBranch = main\n";

fn git(root: &Path, args: &[&str]) -> io::Result<()> {
    let config = root.join(".git-eval-config");
    let status = std::process::Command::new("git")
        .args(args)
        .current_dir(root)
        .env("GIT_CONFIG_GLOBAL", &config)
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()?;
    if status.success() {
        Ok(())
    } else {
        Err(io::Error::other(format!("git {} failed", args.join(" "))))
    }
}

/// Make `root` a git repository on `main` with one commit holding everything
/// except [`UNCOMMITTED_DIR`], then move that folder's contents over the
/// project as uncommitted changes.
pub fn git_init(root: &Path) -> io::Result<()> {
    let config = root.join(".git-eval-config");
    fs::write(&config, GIT_IDENTITY)?;
    let result = (|| {
        git(root, &["init", "-q"])?;
        let exclude = format!(":(exclude){UNCOMMITTED_DIR}");
        git(
            root,
            &[
                "add",
                "-A",
                "--",
                ".",
                ":(exclude).git-eval-config",
                &exclude,
            ],
        )?;
        git(root, &["commit", "-q", "--no-verify", "-m", "fixture"])
    })();
    fs::remove_file(&config)?;
    result?;
    let pending = root.join(UNCOMMITTED_DIR);
    if pending.is_dir() {
        copy_tree(&pending, root)?;
        fs::remove_dir_all(&pending)?;
    }
    Ok(())
}

/// Give a run's empty `HOME` the same git identity, so the model's own
/// `git commit` works without reaching the user's config.
pub fn write_git_identity(home: &Path) -> io::Result<()> {
    fs::write(home.join(".gitconfig"), GIT_IDENTITY)
}
