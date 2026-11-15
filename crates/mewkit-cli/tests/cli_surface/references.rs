//! Find every `mewkit <verb> [<sub>] [--flag …]` written in a set of text trees and say
//! which ones the binary would not run as written.
//!
//! Shared by the kit check (`kit_verbs.rs`) and the docs check (`docs_cli.rs`). A verb that
//! was renamed or never existed fails mid-session; a flag that does not exist is worse,
//! because the verbs ported from the npm CLI drop unknown flags (`argv_compat.rs`) and the
//! command runs without the behaviour the text promised.

use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};

use regex::Regex;

use super::{Node, verbs};

/// Build output is not authored docs: it carries whatever the sources said when
/// it was last built, so a stale bundle would report a command the docs have
/// already stopped teaching. `.vercel` holds the landing site's built tree.
const SKIP_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "dist",
    ".next",
    ".vercel",
    "worktrees",
    "logs",
];
const EXTENSIONS: &[&str] = &[
    "md", "mdx", "cjs", "js", "mjs", "ts", "sh", "py", "json", "yml", "yaml", "txt", "vue",
];

/// Words that follow `mewkit`, or a verb, in prose without naming a command. A word that is
/// also a real command must never be listed: it would silence every reference to it.
const PROSE_EITHER_SLOT: &[&str] = &[
    "is", "and", "to", "in", "on", "the", "a", "as", "at", "for", "from", "it", "its", "of", "or",
    "if", "then", "that", "this", "with", "without", "when", "while", "where", "which", "can",
    "cannot", "does", "did", "will", "would", "must", "should", "may", "run", "runs", "ran",
    "reads", "writes", "command", "commands", "verb", "verbs", "via",
];
const NOT_A_SUBCOMMAND: &[&str] = &[
    "so",
    "prints",
    "records",
    "reports",
    "refuses",
    "subcommand",
    "subcommands",
    "form",
    "output",
    "first",
    "before",
    "after",
    "again",
    "already",
    "never",
    "always",
    "only",
    "still",
    "against",
    "inside",
    "into",
    "over",
    "per",
    "and-then",
];
const NOT_A_VERB: &[&str] = &[
    "cli",
    "has",
    "have",
    "had",
    "repo",
    "repository",
    "project",
    "projects",
    "kit",
    "install",
    "installed",
    "installs",
    "v",
    "version",
    "binary",
    "package",
    "workflow",
    "workflows",
    "session",
    "sessions",
    "agent",
    "agents",
    "skills",
    "hook",
    "hooks",
    "rule",
    "rules",
    "own",
    "they",
    "under",
    "who",
    "why",
    "but",
    "by",
    "not",
    "no",
    "you",
    "your",
    "we",
    "us",
    "ships",
    "shipped",
    "tracks",
    "tracked",
    "runtime",
    "sync",
    "knows",
];
/// Flags every command answers; clap prints them as `-h, --help` / `-V, --version`.
const UNIVERSAL_FLAGS: &[&str] = &["help", "version"];

/// What a scan found: unresolved references as `file:line: why`, and how many calls it saw.
pub struct Scan {
    pub findings: Vec<String>,
    pub calls: usize,
}

/// One command node's accepted long flags, read from its `Options:` block.
fn flags_of(node: &Node) -> BTreeSet<String> {
    let flag = Regex::new(r"^\s+(?:-\w, )?--([a-z][a-z0-9-]*)").expect("regex");
    node.help
        .lines()
        .filter_map(|l| flag.captures(l).map(|c| c[1].to_string()))
        .collect()
}

struct Verb {
    flags: BTreeSet<String>,
    subs: BTreeMap<String, BTreeSet<String>>,
    positional_subverbs: Vec<String>,
    takes_argument: bool,
}

fn table() -> BTreeMap<String, Verb> {
    verbs()
        .into_iter()
        .map(|v| {
            let entry = Verb {
                flags: flags_of(&v),
                subs: v
                    .children
                    .iter()
                    .map(|c| (c.path[1].clone(), flags_of(c)))
                    .collect(),
                positional_subverbs: v.positional_subverbs(),
                takes_argument: v.takes_argument(),
            };
            (v.path[0].clone(), entry)
        })
        .collect()
}

fn walk(dir: &Path, skip: &[PathBuf], out: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        if skip.iter().any(|s| path.starts_with(s)) {
            continue;
        }
        if path.is_dir() {
            if !SKIP_DIRS.contains(&name.as_str()) {
                walk(&path, skip, out);
            }
        } else if path
            .extension()
            .and_then(|e| e.to_str())
            .is_some_and(|e| EXTENSIONS.contains(&e))
        {
            out.push(path);
        }
    }
}

/// The text after a call up to where the command plainly ends, so a flag of the next
/// command or of a shell pipe on the same line is not charged to this one.
fn tail(rest: &str) -> &str {
    let end = ["`", "|", ";", "&&", "#", ")", "]", "\"", "'"]
        .iter()
        .filter_map(|stop| rest.find(stop))
        .min()
        .unwrap_or(rest.len());
    &rest[..end]
}

/// The text files at `path` under `root` (a file or a directory), leaving out `skip`.
pub fn files(root: &Path, path: &str, skip: &[&str], out: &mut Vec<PathBuf>) {
    let skip: Vec<PathBuf> = skip.iter().map(|s| root.join(s)).collect();
    let full = root.join(path);
    if full.is_file() {
        out.push(full);
    } else {
        walk(&full, &skip, out);
    }
}

/// Scan `paths` (files or directories) under `root`, leaving out anything under `skip`.
/// `check_flags` also resolves every `--flag` written after a call.
pub fn scan(root: &Path, paths: &[&str], skip: &[&str], check_flags: bool) -> Scan {
    let table = table();
    let call =
        Regex::new(r"\b(?:npx\s+)?(?:mewkit|mk)\s+([a-z][a-z0-9-]*)(?:\s+([a-z][a-z0-9-]*))?")
            .expect("regex");
    let long_flag = Regex::new(r"(?:^|\s)--([a-z][a-z0-9-]*)").expect("regex");
    let mut files = Vec::new();
    for p in paths {
        self::files(root, p, skip, &mut files);
    }
    files.sort();
    let (mut findings, mut calls) = (Vec::new(), 0);
    for file in files {
        let Ok(text) = fs::read_to_string(&file) else {
            continue;
        };
        let rel = file
            .strip_prefix(root)
            .unwrap_or(&file)
            .display()
            .to_string();
        for (index, line) in text.lines().enumerate() {
            for m in call.captures_iter(line) {
                let verb = &m[1];
                if PROSE_EITHER_SLOT.contains(&verb) || NOT_A_VERB.contains(&verb) {
                    continue;
                }
                calls += 1;
                let at = format!("{rel}:{}", index + 1);
                let Some(v) = table.get(verb) else {
                    findings.push(format!("{at}: `mewkit {verb}` is not a known command"));
                    continue;
                };
                let sub = m.get(2).map(|s| s.as_str());
                let mut flags = &v.flags;
                if let Some(sub) = sub {
                    if let Some(sub_flags) = v.subs.get(sub) {
                        flags = sub_flags;
                    } else if !(PROSE_EITHER_SLOT.contains(&sub)
                        || NOT_A_SUBCOMMAND.contains(&sub)
                        || v.positional_subverbs.iter().any(|s| s == sub)
                        // A positional with no listed values (`note <KIND>`) takes values.
                        || v.positional_subverbs.is_empty() && v.takes_argument)
                    {
                        findings.push(format!(
                            "{at}: `mewkit {verb} {sub}` is not a known subcommand of `{verb}`"
                        ));
                        continue;
                    }
                }
                if !check_flags {
                    continue;
                }
                for f in long_flag.captures_iter(tail(&line[m.get(0).unwrap().end()..])) {
                    let name = &f[1];
                    if !UNIVERSAL_FLAGS.contains(&name) && !flags.contains(name) {
                        let cmd = sub
                            .filter(|s| v.subs.contains_key(*s))
                            .map_or(verb.to_string(), |s| format!("{verb} {s}"));
                        findings.push(format!("{at}: `mewkit {cmd}` has no `--{name}`"));
                    }
                }
            }
        }
    }
    Scan { findings, calls }
}
