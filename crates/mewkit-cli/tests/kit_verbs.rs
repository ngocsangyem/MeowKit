//! Every `mewkit <verb> [<sub>] [--flag]` the shipped kit tells an agent to run resolves.
//!
//! A verb that was renamed or never existed fails mid-session, inside a workflow the agent
//! cannot finish. Both halves are checked: a verb-only check once passed a kit naming a
//! subcommand that had never existed. The second token is resolved only when the verb
//! declares subcommands, or names its accepted values in a `[SUBCOMMAND]` positional (a verb
//! with neither, or one taking a plain positional value, treats the next word as prose or a
//! value). Each `--flag` after a call must be one that command declares.

mod cli_surface;

use std::fs;
use std::path::{Path, PathBuf};

use cli_surface::references::scan;

/// Only the shipped kit and its Codex and Cursor overlays: `docs/` carries history naming
/// verbs that existed at the time.
const TREES: &[&str] = &[".claude", "kit/overlays"];

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

/// Every unresolved reference as `file:line: reference`, plus the number of calls seen.
fn unresolved(root: &Path) -> (Vec<String>, usize) {
    let s = scan(root, TREES, &[], true);
    (s.findings, s.calls)
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
