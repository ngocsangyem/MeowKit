//! `review read` — print one assigned artifact and leave a receipt that it was
//! opened.
//!
//! Reads are CONFINED to the session directory and the review worktree. The
//! worktree holds the pull request's own code, so a purely lexical containment
//! check is not enough: a symlink inside it would point anywhere on the
//! machine and a read through it would exfiltrate a file the reviewer never
//! asked for. Both the candidate and the root are therefore resolved to their
//! REAL paths before the containment test, which also folds macOS's
//! `/tmp`→`/private/tmp` indirection so the logged target matches what the
//! hook sees.
//!
//! The receipt is best-effort: a logging failure is reported but never hides
//! the read that already happened.
use std::path::{Path, PathBuf};
use std::sync::LazyLock;

use regex::Regex;
use serde_json::json;

use super::session::{relative, session_dir};
use crate::schema::review_manifest::ReviewManifest;

/// A session or reviewer id that is safe as a path segment and as a log key.
static ID_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^[A-Za-z0-9][A-Za-z0-9._-]*$").expect("static id pattern"));

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReadOutcome {
    pub content: String,
    /// The path as it is recorded in the evidence log: relative to whichever
    /// root contained it.
    pub logged_target: String,
    /// A receipt that could not be appended. The read still succeeded.
    pub evidence_error: Option<String>,
}

pub struct ReadOptions<'a> {
    /// `None` is an ABSENT flag. The npm CLI's refusal interpolates the
    /// JavaScript value, so an absent one is quoted as the word `undefined` —
    /// which is also a perfectly valid id, and must not be looked up as one.
    pub session: Option<&'a str>,
    pub reviewer: Option<&'a str>,
    pub target: ReadTarget<'a>,
    pub cwd: &'a Path,
    pub now: &'a str,
}

/// The positional as the npm CLI's argument parser produced it. minimist
/// coerces a numeric positional to a NUMBER, and the difference is observable:
/// a number is truthy (so it passes the "a path is required" check) and then
/// dies inside `path.resolve`, AFTER the session has been located.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ReadTarget<'a> {
    Text(&'a str),
    Number(f64),
}

/// How a read was refused. A `Fatal` is the npm CLI dying inside Node's path
/// API rather than refusing — different text, same exit code, and callers that
/// branch on the output can tell them apart.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReadRefusal {
    Message(String),
    Fatal(String),
}

impl ReadRefusal {
    fn message(text: impl Into<String>) -> Self {
        Self::Message(text.into())
    }
}

fn contained(root: &Path, candidate: &Path) -> bool {
    candidate == root || candidate.starts_with(root)
}

/// The worktree root named by a VALID manifest. An unreadable or invalid
/// manifest leaves session-directory reads working and nothing else.
fn worktree_root(session_dir: &Path, cwd: &Path) -> Option<PathBuf> {
    let value = super::session::read_json(&session_dir.join("manifest.json"))?;
    ReviewManifest::parse(&value).ok()?;
    let relative_path = value.get("worktreePath")?.as_str()?;
    Some(cwd.join(relative_path))
}

pub fn read(options: &ReadOptions<'_>) -> Result<ReadOutcome, ReadRefusal> {
    let session = match options.session {
        Some(s) if !s.is_empty() && !s.contains("..") && ID_RE.is_match(s) => s,
        other => {
            return Err(ReadRefusal::message(format!(
                "invalid --session \"{}\"",
                other.unwrap_or("undefined")
            )));
        }
    };
    let reviewer = match options.reviewer {
        Some(r) if !r.is_empty() && ID_RE.is_match(r) => r,
        other => {
            return Err(ReadRefusal::message(format!(
                "invalid --as reviewer id \"{}\"",
                other.unwrap_or("undefined")
            )));
        }
    };
    // `0` and `""` are both falsy, so both read as "no path was given".
    let falsy = match options.target {
        ReadTarget::Text(text) => text.is_empty(),
        ReadTarget::Number(number) => number == 0.0,
    };
    if falsy {
        return Err(ReadRefusal::message("a <path> to read is required"));
    }

    let dir = session_dir(options.cwd, session);
    if !dir.join("manifest.json").exists() {
        return Err(ReadRefusal::message(format!(
            "no review session at {}",
            relative(options.cwd, &dir)
        )));
    }
    // Only now does the path API see the value, which is where a numeric
    // positional kills the npm CLI.
    let target = match options.target {
        ReadTarget::Text(text) => text,
        ReadTarget::Number(number) => {
            return Err(ReadRefusal::Fatal(format!(
                "The \"paths[1]\" argument must be of type string. Received type number ({})",
                crate::js_value::js_number_text(number)
            )));
        }
    };

    let mut roots = vec![dir.clone()];
    if let Some(worktree) = worktree_root(&dir, options.cwd) {
        roots.push(worktree);
    }
    let mut resolved = None;
    for root in &roots {
        let candidate = root.join(target);
        if !contained(root, &candidate) {
            continue; // lexical fast-reject
        }
        let (Ok(real), Ok(real_root)) = (candidate.canonicalize(), root.canonicalize()) else {
            continue; // broken symlink, or a path that does not exist
        };
        if !contained(&real_root, &real) || !real.is_file() {
            continue; // the symlink escaped its root
        }
        let logged = relative(&real_root, &real);
        resolved = Some((real, logged));
        break;
    }
    let Some((path, logged_target)) = resolved else {
        return Err(ReadRefusal::message(format!(
            "\"{target}\" not found inside the session dir or review worktree \
             (reads are confined to those roots; symlinks may not escape them)"
        )));
    };

    // Decoded LOSSILY, as `readFileSync(path, "utf-8")` does: a reviewer who
    // opens a binary artifact should see replacement characters, the way the
    // npm CLI shows them, not a refusal that reads as "the file is missing".
    let bytes = std::fs::read(&path).map_err(|e| ReadRefusal::message(e.to_string()))?;
    let content = String::from_utf8_lossy(&bytes).into_owned();
    let event = json!({
        "session": session,
        "kind": "read",
        "target": logged_target,
        "at": options.now,
        "reviewer": reviewer,
        "source": "cli",
    });
    let evidence_error = append_line(&dir.join("evidence.jsonl"), &event.to_string()).err();

    Ok(ReadOutcome {
        content,
        logged_target,
        evidence_error,
    })
}

fn append_line(path: &Path, line: &str) -> Result<(), String> {
    use std::io::Write;
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|e| e.to_string())?;
    file.write_all(format!("{line}\n").as_bytes())
        .map_err(|e| e.to_string())
}

#[cfg(test)]
#[path = "read_tests.rs"]
mod tests;
