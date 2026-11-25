//! A filesystem facade that records every write it is asked for and performs it
//! only when this is not a dry run.
//!
//! A step cannot report a change it did not make, or make one it did not report:
//! the recorded item IS the write, so the `--dry-run` preview cannot drift from
//! what a real run does. Every write refuses a symlinked target or parent
//! under the root, so a project file cannot redirect setup outside it.
use std::io;
use std::path::Path;

use crate::fsx::{append_in, create_dir_all_in, read_in, write_in};

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
        write_in(self.root, file, content)
    }

    pub fn copy(&mut self, from: &Path, to: &Path) -> io::Result<()> {
        let detail = format!("from {}", self.rel(from));
        self.record("copy", to, Some(&detail));
        if self.dry_run {
            return Ok(());
        }
        // The source is read without following a link too: a linked example
        // file would copy whatever it points at into the project.
        write_in(self.root, to, read_in(self.root, from)?)
    }

    pub fn append(&mut self, file: &Path, content: &str) -> io::Result<()> {
        self.record("append", file, None);
        if self.dry_run {
            return Ok(());
        }
        use std::io::Write;
        append_in(self.root, file)?.write_all(content.as_bytes())
    }

    pub fn mkdir(&mut self, dir: &Path) -> io::Result<()> {
        if dir.exists() {
            return Ok(());
        }
        self.record("mkdir", dir, None);
        if self.dry_run {
            return Ok(());
        }
        create_dir_all_in(self.root, dir)
    }
}
