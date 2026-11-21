//! Slash commands written in kit text: does a skill answer to each one?
//!
//! A command named in prose that no skill defines sends a reader (or an agent)
//! to something that does not exist. The command set is built from the skills
//! actually present, so a renamed or removed skill makes every stale mention
//! show up without a list to maintain.
//!
//! Only two shapes count as a command, because `/word` is also how URL routes
//! and absolute paths read: a backticked span that starts with `/name`, and a
//! usage line that starts with `/name`. `/name/rest` is a path and never
//! matches, and a short list of route words and host built-ins is excluded.
use std::collections::BTreeSet;
use std::path::Path;
use std::sync::LazyLock;

use regex::Regex;

use super::inventory_read::read_frontmatter;

/// Slash commands the host tools provide, so no skill defines them.
const HOST_BUILTINS: [&str; 41] = [
    "help",
    "clear",
    "compact",
    "model",
    "init",
    "review",
    "memory",
    "config",
    "status",
    "cost",
    "doctor",
    "login",
    "logout",
    "mcp",
    "permissions",
    "agents",
    "hooks",
    "context",
    "resume",
    "rewind",
    "export",
    "ide",
    "vim",
    "bug",
    "usage",
    "plugin",
    "plugins",
    "skills",
    "statusline",
    "fast",
    "effort",
    "theme",
    "add-dir",
    "terminal-setup",
    "pr-comments",
    "output-style",
    "new",
    "diff",
    "mention",
    "quit",
    "exit",
];

/// Words that appear as `/word` for a URL route or a directory in examples.
const ROUTE_WORDS: [&str; 24] = [
    "checkout",
    "cart",
    "product",
    "user",
    "dashboard",
    "settings",
    "profile",
    "order",
    "messages",
    "state",
    "data",
    "src",
    "src-backup",
    "src-old",
    "absent",
    "tmp",
    "etc",
    "usr",
    "var",
    "bin",
    "dev",
    "home",
    "opt",
    "api",
];

// Spans are paired left to right first, so the closing backtick of one span is
// never read as the opening backtick of a command in the next.
static CODE_SPAN: LazyLock<Regex> =
    LazyLock::new(|| crate::js_regex::compile(r"`([^`]*)`").expect("a static code-span pattern"));
static SPAN_COMMAND: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile(r"^/(mk:)?([a-z][a-z0-9-]*)(?:\s.*)?$")
        .expect("a static span-command pattern")
});
static LINE_START: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile(r"^\s*(?:[-*>]\s+)?/(mk:)?([a-z][a-z0-9-]*)(?:\s|$)")
        .expect("a static usage-line pattern")
});

/// Every command name a skill defines: the frontmatter `name` without its
/// `mk:` prefix, plus the directory name, since a command is invoked by either.
pub(super) fn known_commands(claude_dir: &Path) -> BTreeSet<String> {
    let mut known = BTreeSet::new();
    for entry in super::dir_order::sorted_entries(&claude_dir.join("skills")) {
        let skill_md = entry.path().join("SKILL.md");
        if !skill_md.is_file() {
            continue;
        }
        known.insert(entry.file_name().to_string_lossy().into_owned());
        let frontmatter = read_frontmatter(&skill_md);
        if let Some(name) = frontmatter.get("name").and_then(|v| v.as_str()) {
            known.insert(name.trim_start_matches("mk:").to_string());
        }
    }
    for entry in super::dir_order::sorted_entries(&claude_dir.join("commands")) {
        if let Some(stem) = Path::new(&entry.file_name()).file_stem() {
            known.insert(stem.to_string_lossy().into_owned());
        }
    }
    known
}

/// The commands one line names that no skill defines, as written (`/name`).
pub(super) fn unknown_commands_in_line(line: &str, known: &BTreeSet<String>) -> Vec<String> {
    let mut found = Vec::new();
    let in_spans = CODE_SPAN
        .captures_iter(line)
        .filter_map(|span| SPAN_COMMAND.captures(span.get(1)?.as_str()));
    let candidates: Vec<_> = in_spans.chain(LINE_START.captures_iter(line)).collect();
    for caps in candidates {
        let prefixed = caps.get(1).is_some();
        let name = &caps[2];
        let excused = known.contains(name)
            || (!prefixed && (HOST_BUILTINS.contains(&name) || ROUTE_WORDS.contains(&name)));
        if !excused {
            let token = format!("/{}{name}", if prefixed { "mk:" } else { "" });
            if !found.contains(&token) {
                found.push(token);
            }
        }
    }
    found
}
