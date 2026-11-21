//! Do the skill paths and links in kit text point at something that ships?
//!
//! Three defects, each a reference that reads fine and leads nowhere:
//!
//! * `mk:name/...` or `../mk:name/...` used as a file path. `mk:` is the
//!   skill's invocation name; the folder is `.claude/skills/name/`, so such a
//!   path is dead wherever it is followed.
//! * a markdown link into `skills/` whose skill directory does not exist.
//! * a markdown link into an existing skill whose target file does not exist.
//!
//! plus slash commands that no skill defines (see `docs_refs_commands`).
//! Findings are advisory in the default run: the kit predates this check, and
//! the list it produces is a work list rather than a build break.
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::LazyLock;

use regex::Regex;

use super::docs_refs::{FILE_WHITELIST, SCAN_DIRS, walk_scanned};
use super::docs_refs_commands::{known_commands, unknown_commands_in_line};
use super::docs_refs_skill_local::missing_local_paths;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LinkKind {
    DeadMkPath,
    MissingSkill,
    MissingReference,
    UnknownCommand,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LinkFinding {
    /// Path relative to the scanned `.claude/` directory.
    pub file: String,
    pub line: usize,
    pub token: String,
    pub kind: LinkKind,
}

static MK_PATH: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile(r"(?:\.\./)*mk:[a-z0-9][a-z0-9-]*/[A-Za-z0-9_./\-]*")
        .expect("a static mk-path pattern")
});
static CODE_SPAN: LazyLock<Regex> =
    LazyLock::new(|| crate::js_regex::compile(r"`[^`]*`").expect("a static code-span pattern"));
static MD_LINK: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile(r#"\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)"#)
        .expect("a static markdown-link pattern")
});

/// Resolve `target` against `dir` without touching the disk, so a link that
/// climbs out of `.claude/` is recognised and left alone. `None` when it escapes.
fn normalize(dir: &Path, target: &str) -> Option<PathBuf> {
    let mut parts: Vec<String> = dir
        .components()
        .map(|c| c.as_os_str().to_string_lossy().into_owned())
        .collect();
    for part in Path::new(target).components() {
        match part {
            Component::ParentDir => {
                parts.pop()?;
            }
            Component::Normal(name) => parts.push(name.to_string_lossy().into_owned()),
            _ => {}
        }
    }
    Some(parts.iter().collect())
}

/// A relative markdown target worth resolving: not a URL, anchor, placeholder
/// or glob. Returns it without any `#fragment` or `?query`.
fn linkable(target: &str) -> Option<&str> {
    let path = target.split(['#', '?']).next().unwrap_or("");
    let skip = path.is_empty()
        || path.starts_with('/')
        || path.contains(':')
        || path.contains(['<', '{', '$', '*', '[']);
    (!skip).then_some(path)
}

/// Markdown links on one line that land in `skills/` and do not resolve.
fn unresolved_links(claude_dir: &Path, file_dir: &Path, line: &str) -> Vec<(String, LinkKind)> {
    let stripped = CODE_SPAN.replace_all(line, "");
    let skills_dir = claude_dir.join("skills");
    let mut out = Vec::new();
    for caps in MD_LINK.captures_iter(&stripped) {
        let Some(path) = linkable(&caps[1]) else {
            continue;
        };
        let Some(resolved) = normalize(file_dir, path) else {
            continue;
        };
        let Ok(inside) = resolved.strip_prefix(&skills_dir) else {
            continue;
        };
        let Some(skill) = inside.components().next() else {
            continue;
        };
        let kind = if !skills_dir.join(skill).is_dir() {
            LinkKind::MissingSkill
        } else if !resolved.exists() {
            LinkKind::MissingReference
        } else {
            continue;
        };
        out.push((caps[1].to_string(), kind));
    }
    out
}

/// Scan the shipped markdown of one `.claude/` directory.
pub fn check_skill_links(claude_dir: &Path) -> Vec<LinkFinding> {
    let known = known_commands(claude_dir);
    let mut findings = Vec::new();
    for sub in SCAN_DIRS {
        let mut files = Vec::new();
        walk_scanned(&claude_dir.join(sub), &mut files);
        for file in files
            .iter()
            .filter(|f| f.extension().is_some_and(|e| e == "md"))
        {
            let rel = file
                .strip_prefix(claude_dir)
                .unwrap_or(file)
                .to_string_lossy()
                .replace('\\', "/");
            // Fixtures and eval data hold sample prose that nothing resolves;
            // the authoring-rules file DEFINES the banned shapes by example.
            if FILE_WHITELIST.contains(&rel.as_str())
                || rel.contains("/evals/")
                || rel.contains("/fixtures/")
            {
                continue;
            }
            let content = String::from_utf8_lossy(&fs::read(file).unwrap_or_default()).into_owned();
            let file_dir = file.parent().unwrap_or(claude_dir);
            let mut in_fence = false;
            let is_template = rel.contains("/templates/") || rel.contains("/assets/");
            let skill_root = rel
                .strip_prefix("skills/")
                .and_then(|inside| inside.split('/').next())
                .map(|skill| claude_dir.join("skills").join(skill));
            let mut push = |line: usize, token: String, kind: LinkKind| {
                findings.push(LinkFinding {
                    file: rel.clone(),
                    line,
                    token,
                    kind,
                });
            };
            for (index, text) in content.split('\n').enumerate() {
                let n = index + 1;
                if text.trim_start().starts_with("```") {
                    in_fence = !in_fence;
                    continue;
                }
                for m in MK_PATH.find_iter(text) {
                    push(
                        n,
                        m.as_str().trim_end_matches('.').to_string(),
                        LinkKind::DeadMkPath,
                    );
                }
                for token in unknown_commands_in_line(text, &known) {
                    push(n, token, LinkKind::UnknownCommand);
                }
                // A link inside a fenced example is sample text, not a reference.
                // Templates carry placeholder links that a user fills in.
                if !in_fence && !is_template {
                    for (token, kind) in unresolved_links(claude_dir, file_dir, text) {
                        push(n, token, kind);
                    }
                    if let Some(root) = &skill_root {
                        for token in missing_local_paths(root, file_dir, text) {
                            push(n, token, LinkKind::MissingReference);
                        }
                    }
                }
            }
        }
    }
    findings
}

#[cfg(test)]
#[path = "docs_refs_links_tests.rs"]
mod docs_refs_links_tests;
