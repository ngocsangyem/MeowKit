//! A filesystem facade that records every write it is asked for and performs it
//! only when this is not a dry run.
//!
//! A step cannot report a change it did not make, or make one it did not report:
//! the recorded item IS the write, so the `--dry-run` preview cannot drift from
//! what a real run does.
use std::io;
use std::path::Path;

/// One line of a change list: what a run would do, or did, to one path.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlannedChange {
    /// `create`, `update`, `append`, `copy`, `mkdir` or `install`.
    pub action: String,
    /// Project-relative where possible, in this OS's separator.
    pub path: String,
    pub detail: Option<String>,
}

pub struct Changes<'a> {
    root: &'a Path,
    pub dry_run: bool,
    pub changes: Vec<PlannedChange>,
}

impl<'a> Changes<'a> {
    pub fn new(root: &'a Path, dry_run: bool) -> Self {
        Self {
            root,
            dry_run,
            changes: Vec::new(),
        }
    }

    /// `path.relative(root, file) || file`.
    pub fn rel(&self, file: &Path) -> String {
        match file.strip_prefix(self.root) {
            Ok(rest) if !rest.as_os_str().is_empty() => rest.display().to_string(),
            _ => file.display().to_string(),
        }
    }

    /// Record a change made by code this facade does not own (an installer, a venv).
    pub fn record(&mut self, action: &str, file: &Path, detail: Option<&str>) {
        self.changes.push(PlannedChange {
            action: action.to_string(),
            path: self.rel(file),
            detail: detail.map(str::to_string),
        });
    }

    pub fn write(&mut self, file: &Path, content: &str) -> io::Result<()> {
        let action = if file.exists() { "update" } else { "create" };
        self.record(action, file, None);
        if self.dry_run {
            return Ok(());
        }
        std::fs::write(file, content)
    }

    pub fn copy(&mut self, from: &Path, to: &Path) -> io::Result<()> {
        let detail = format!("from {}", self.rel(from));
        self.record("copy", to, Some(&detail));
        if self.dry_run {
            return Ok(());
        }
        std::fs::copy(from, to).map(|_| ())
    }

    pub fn append(&mut self, file: &Path, content: &str) -> io::Result<()> {
        self.record("append", file, None);
        if self.dry_run {
            return Ok(());
        }
        use std::io::Write;
        std::fs::OpenOptions::new()
            .append(true)
            .create(true)
            .open(file)?
            .write_all(content.as_bytes())
    }

    pub fn mkdir(&mut self, dir: &Path) -> io::Result<()> {
        if dir.exists() {
            return Ok(());
        }
        self.record("mkdir", dir, None);
        if self.dry_run {
            return Ok(());
        }
        std::fs::create_dir_all(dir)
    }
}
