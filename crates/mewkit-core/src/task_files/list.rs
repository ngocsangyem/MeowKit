//! `task list` — the table of task files, with the same columns and the same
//! padding as the npm CLI's.
//!
//! Colour is absent on purpose: the npm CLI's colouring is disabled whenever
//! stdout is not a terminal, which is every case a script, a hook or a test
//! reads, so the uncoloured text IS the shared contract.
use std::path::Path;

use crate::memory::utf16_len;

use super::discovery::{collect_md_files, find_tasks_dir, find_tasks_root, parse_frontmatter};
use super::output::TaskOutput;

/// One row of the table.
struct Row {
    status: String,
    task_type: String,
    priority: String,
    title: String,
    rel_path: String,
}

/// Render the listing. `all` scans the whole `tasks/` tree instead of
/// `tasks/active/`; `status` filters by the frontmatter status.
///
/// Every outcome is text, not a failure: "no tasks/ directory" and "nothing
/// matched" are answers, and the npm CLI exits 0 for both.
pub fn list_tasks(cwd: &Path, all: bool, status: Option<&str>) -> TaskOutput {
    let root = if all {
        find_tasks_root(cwd)
    } else {
        find_tasks_dir(cwd)
    };
    let Some(root) = root else {
        return TaskOutput::ok(
            "\n  No tasks/ directory found. Run from a MeowKit project.\n\n".to_string(),
        );
    };
    let files = match collect_md_files(&root) {
        Ok(files) => files,
        Err(e) => return TaskOutput::refused(format!("Fatal: {e}\n")),
    };
    if files.is_empty() {
        return TaskOutput::ok(format!("\n  No task files found in {}\n\n", root.display()));
    }

    let mut rows = Vec::new();
    for file in &files {
        let content = match std::fs::read_to_string(file) {
            Ok(content) => content,
            Err(e) => return TaskOutput::refused(format!("Fatal: {e}\n")),
        };
        let front = parse_frontmatter(&content);
        let found = front.status.unwrap_or_else(|| "unknown".to_string());
        if status.is_some_and(|wanted| found != wanted) {
            continue;
        }
        rows.push(Row {
            status: found,
            task_type: front.task_type.unwrap_or_else(|| "unknown".to_string()),
            priority: front.priority.unwrap_or_else(|| "medium".to_string()),
            title: front.title.unwrap_or_else(|| basename_stem(file)),
            rel_path: relative_to(cwd, file),
        });
    }
    if rows.is_empty() {
        return TaskOutput::ok(format!(
            "\n  No tasks with status \"{}\"\n\n",
            status.unwrap_or("any")
        ));
    }

    let mut out = format!(
        "\n  {}{}{}  {}  Path\n",
        pad_end("Status", 12),
        pad_end("Type", 14),
        pad_end("Priority", 8),
        pad_end("Title", 40)
    );
    out.push_str(&format!("  {}\n", "─".repeat(100)));
    for row in &rows {
        out.push_str(&format!(
            "  {}{}{}  {}  {}\n",
            pad_end(&row.status, 12),
            pad_end(&row.task_type, 14),
            pad_end(&row.priority, 8),
            pad_end(&row.title, 40),
            row.rel_path
        ));
    }
    out.push_str(&format!(
        "\n  {} task{} found\n\n",
        rows.len(),
        if rows.len() == 1 { "" } else { "s" }
    ));
    TaskOutput::ok(out)
}

/// `String#padEnd` with the npm CLI's truncation: a value at or over the width
/// is CUT to it, so a long title cannot shift the columns.
///
/// Width is counted in UTF-16 code units, which is what `String#length`
/// counts, so a non-ASCII title pads to the same column there and here. The cut
/// stays on a character boundary — where JavaScript would split a surrogate
/// pair, this keeps the pair out instead of emitting half of one.
fn pad_end(value: &str, width: usize) -> String {
    let len = utf16_len(value);
    if len >= width {
        let mut out = String::new();
        let mut taken = 0;
        for ch in value.chars() {
            let next = taken + ch.len_utf16();
            if next > width {
                break;
            }
            out.push(ch);
            taken = next;
        }
        return out;
    }
    format!("{value}{}", " ".repeat(width - len))
}

/// The filename without its `.md`, the fallback title for a file with no
/// `title:` in its frontmatter.
fn basename_stem(file: &Path) -> String {
    let name = file
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    name.strip_suffix(".md").unwrap_or(&name).to_string()
}

/// `path.relative(cwd, file)` — the path as the user would type it from here,
/// with `..` segments when the task tree is above the working directory.
fn relative_to(cwd: &Path, file: &Path) -> String {
    if let Ok(rest) = file.strip_prefix(cwd) {
        return rest.display().to_string();
    }
    let mut up = Vec::new();
    let mut base = cwd;
    while let Some(parent) = base.parent() {
        up.push("..");
        if let Ok(rest) = file.strip_prefix(parent) {
            let mut parts = up.join(std::path::MAIN_SEPARATOR_STR);
            parts.push(std::path::MAIN_SEPARATOR);
            parts.push_str(&rest.display().to_string());
            return parts;
        }
        base = parent;
    }
    file.display().to_string()
}
