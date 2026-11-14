//! A throwaway project mirroring a real install closely enough to run its
//! configured hooks: the whole `.claude/hooks/` tree (including `lib/`, so
//! relative `source` paths resolve under `CLAUDE_PROJECT_DIR`) plus
//! `.claude/settings.json`. The probes mutate plan and `.env` state inside it,
//! never the real project.
use std::io;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

/// True when `<root>/.claude/settings.json` and the hooks tree both exist.
pub fn has_harness(root: &Path) -> bool {
    root.join(".claude/settings.json").exists() && root.join(".claude/hooks").exists()
}

pub struct Scaffold {
    pub dir: PathBuf,
}

fn copy_tree(from: &Path, to: &Path) -> io::Result<()> {
    std::fs::create_dir_all(to)?;
    for entry in std::fs::read_dir(from)? {
        let entry = entry?;
        let target = to.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_tree(&entry.path(), &target)?;
        } else {
            // `copy` keeps the mode, which is what keeps a hook executable.
            std::fs::copy(entry.path(), target)?;
        }
    }
    Ok(())
}

/// A fixed identity, so the probe repo can commit on a host with no git config.
fn git(dir: &Path, args: &[&str]) -> bool {
    Command::new("git")
        .args(args)
        .current_dir(dir)
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_SYSTEM", "/dev/null")
        .env("GIT_AUTHOR_NAME", "mewkit doctor")
        .env("GIT_AUTHOR_EMAIL", "doctor@example.invalid")
        .env("GIT_COMMITTER_NAME", "mewkit doctor")
        .env("GIT_COMMITTER_EMAIL", "doctor@example.invalid")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok_and(|s| s.success())
}

impl Scaffold {
    pub fn new(src: &Path) -> io::Result<Self> {
        let tmp = std::env::temp_dir();
        let mut n = 0u32;
        let dir = loop {
            let candidate = tmp.join(format!("mewkit-hardgate-{}-{n}", std::process::id()));
            match std::fs::create_dir(&candidate) {
                Ok(()) => break candidate,
                Err(e) if e.kind() == io::ErrorKind::AlreadyExists => n += 1,
                Err(e) => return Err(e),
            }
        };
        let this = Self { dir };
        let claude = this.dir.join(".claude");
        copy_tree(&src.join(".claude/hooks"), &claude.join("hooks"))?;
        std::fs::copy(
            src.join(".claude/settings.json"),
            claude.join("settings.json"),
        )?;
        std::fs::create_dir_all(this.dir.join("tasks/plans"))?;
        std::fs::create_dir_all(this.dir.join("tasks/contracts"))?;
        std::fs::write(this.dir.join("CLAUDE.md"), "# test project\n")?;
        Ok(this)
    }

    /// A pending plan under `tasks/plans/260531-demo/plan.md`. A plan alone does
    /// not open Gate 1: it also needs an approval receipt.
    pub fn add_nested_plan(&self) -> PathBuf {
        let dir = self.dir.join("tasks/plans/260531-demo");
        let _ = std::fs::create_dir_all(&dir);
        let path = dir.join("plan.md");
        let _ = std::fs::write(&path, "---\nstatus: pending\n---\n# plan\n");
        path
    }

    pub fn clear_plans(&self) {
        let plans = self.dir.join("tasks/plans");
        let _ = std::fs::remove_dir_all(&plans);
        let _ = std::fs::create_dir_all(&plans);
    }

    pub fn add_signed_contract(&self) {
        let _ = std::fs::write(
            self.dir.join("tasks/contracts/260531-demo-sprint-1.md"),
            "---\nstatus: signed\n---\n\n# contract\n",
        );
    }

    pub fn add_env_file(&self) {
        let _ = std::fs::write(self.dir.join(".env"), "SECRET=do-not-read\n");
    }

    /// Stamp the Gate 1 receipt through the COPIED helper, so the stamp and the
    /// live gate's verify come from the same code.
    pub fn approve_plan(&self, plan: &Path) -> bool {
        let helper = self.dir.join(".claude/hooks/lib/approval-receipt.cjs");
        if !helper.exists() {
            return false;
        }
        let quote =
            |p: &Path| serde_json::Value::String(p.to_string_lossy().into_owned()).to_string();
        let stamp = format!(
            "require({}).stamp({}, \"doctor\")",
            quote(&helper),
            quote(plan)
        );
        Command::new("node")
            .args(["-e", &stamp])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .is_ok_and(|s| s.success())
    }

    /// A repo with a staged source file, so a ship command has a real change set.
    pub fn stage_ship_commit(&self) -> bool {
        let d = &self.dir;
        git(d, &["init", "-q"])
            && std::fs::write(d.join("README.md"), "# probe\n").is_ok()
            && git(d, &["add", "README.md"])
            && git(d, &["commit", "-q", "-m", "base"])
            && std::fs::create_dir_all(d.join("src")).is_ok()
            && std::fs::write(d.join("src/app.ts"), "export const a = 1;\n").is_ok()
            && git(d, &["add", "src/app.ts"])
    }
}

impl Drop for Scaffold {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.dir);
    }
}
