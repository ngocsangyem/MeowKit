//! Every `mewkit <verb> [<sub>]` the shipped kit tells an agent to run resolves.
//!
//! A verb that was renamed or never existed fails mid-session, inside a workflow the agent
//! cannot finish. Both halves are checked: a verb-only check once passed a kit naming a
//! subcommand that had never existed. The second token is resolved only when the verb
//! declares subcommands, or names its accepted values in a `[SUBCOMMAND]` positional (a verb
//! with neither, or one taking a plain positional value, treats the next word as prose or a
//! value).

mod cli_surface;

use std::fs;
use std::path::{Path, PathBuf};

use regex::Regex;

/// Only the shipped kit: `docs/` carries history naming verbs that existed at the time.
const TREES: &[&str] = &[".claude"];
const SKIP_DIRS: &[&str] = &["node_modules", ".git", "dist", ".next", "worktrees", "logs"];
const EXTENSIONS: &[&str] = &[
    "md", "mdx", "cjs", "js", "mjs", "ts", "sh", "py", "json", "yml", "yaml",
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

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn walk(dir: &Path, out: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        if path.is_dir() {
            if !SKIP_DIRS.contains(&name.as_str()) {
                walk(&path, out);
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

fn is_prose(word: &str, extra: &[&str]) -> bool {
    PROSE_EITHER_SLOT.contains(&word) || extra.contains(&word)
}

/// Every unresolved reference as `file:line: reference`, plus the number of calls seen.
fn unresolved(root: &Path) -> (Vec<String>, usize) {
    let surface = cli_surface::surface();
    let call = Regex::new(r"\b(?:npx\s+)?mewkit\s+([a-z][a-z0-9-]*)(?:\s+([a-z][a-z0-9-]*))?")
        .expect("regex");
    let mut files = Vec::new();
    for tree in TREES {
        walk(&root.join(tree), &mut files);
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
                if is_prose(verb, NOT_A_VERB) {
                    continue;
                }
                calls += 1;
                let at = format!("{rel}:{}", index + 1);
                let Some(subs) = surface.subcommands.get(verb) else {
                    findings.push(format!("{at}: `mewkit {verb}` is not a known command"));
                    continue;
                };
                let Some(sub) = m.get(2).map(|s| s.as_str()) else {
                    continue;
                };
                if is_prose(sub, NOT_A_SUBCOMMAND) || subs.iter().any(|s| s == sub) {
                    continue;
                }
                // A free-text positional names its accepted values in help; a verb with
                // a positional but no such list (`note <KIND>`) takes values, not sub-verbs.
                match surface.positional_subverbs.get(verb) {
                    Some(values) if values.iter().any(|v| v == sub) => continue,
                    None if surface.takes_argument.iter().any(|v| v == verb) => continue,
                    _ => {}
                }
                findings.push(format!(
                    "{at}: `mewkit {verb} {sub}` is not a known subcommand of `{verb}`"
                ));
            }
        }
    }
    (findings, calls)
}

#[test]
fn every_kit_verb_reference_resolves() {
    let (findings, calls) = unresolved(&repo_root());
    assert!(
        calls > 100,
        "scanned only {calls} references; scope broken?"
    );
    assert!(
        findings.is_empty(),
        "{} unresolved mewkit reference(s):\n{}",
        findings.len(),
        findings.join("\n")
    );
}

#[test]
fn a_planted_stale_verb_is_caught() {
    let dir = tempfile::tempdir().expect("tempdir");
    let kit = dir.path().join(".claude/skills/x");
    fs::create_dir_all(&kit).expect("mkdir");
    fs::write(
        kit.join("a.md"),
        "Run `mewkit frobnicate --now`, then `mewkit plan nope`.\n",
    )
    .expect("write");
    let (findings, _) = unresolved(dir.path());
    assert!(findings.iter().any(|f| f.contains("frobnicate")));
    assert!(findings.iter().any(|f| f.contains("plan nope")));
}

/// A verb whose sub-verb is a free-text positional must still reject a made-up one.
#[test]
fn a_planted_bad_positional_subverb_is_caught() {
    let dir = tempfile::tempdir().expect("tempdir");
    let kit = dir.path().join(".claude/skills/x");
    fs::create_dir_all(&kit).expect("mkdir");
    fs::write(
        kit.join("a.md"),
        "Run `mewkit budget nonsense`, but `mewkit budget context` is real.\n",
    )
    .expect("write");
    let (findings, _) = unresolved(dir.path());
    assert!(findings.iter().any(|f| f.contains("budget nonsense")));
    assert!(!findings.iter().any(|f| f.contains("budget context")));
}

/// The derived lists, pinned so a help rewording that drops a value fails loudly.
#[test]
fn positional_subverbs_are_read_from_help() {
    let s = cli_surface::surface();
    let get = |v: &str| s.positional_subverbs.get(v).cloned().unwrap_or_default();
    assert_eq!(
        get("capabilities"),
        [
            "list",
            "explain",
            "resolve",
            "view",
            "bootstrap",
            "projections"
        ]
    );
    assert_eq!(get("budget"), ["context"]);
    assert_eq!(get("skill"), ["env"]);
    assert_eq!(get("doctor"), ["provenance"]);
    assert_eq!(get("trace"), ["score", "audit", "propose"]);
    assert_eq!(get("pack"), ["list", "add", "remove"]);
    assert_eq!(get("backups"), ["list", "restore"]);
    assert_eq!(
        get("review"),
        [
            "prepare", "read", "coverage", "compose", "submit", "cleanup"
        ]
    );
    assert_eq!(
        get("advice"),
        ["begin", "commit", "status", "validate-packet"]
    );
}
