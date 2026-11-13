use std::cell::RefCell;
use std::path::{Path, PathBuf};

use serde_json::{Value, json};

use super::super::exec::{Exec, ExecResult};
use super::{PrepareOptions, default_session_id, prepare, random_hex8};

const REMOTES: &str = "origin\tgit@github.com:me/fork.git (fetch)\n\
     upstream\thttps://github.com/acme/widget.git (fetch)\n";
const DIFF: &str = "diff --git a/src/a.ts b/src/a.ts\n@@ -0,0 +1,1 @@\n+export const x = 1;\n";

/// Answers each program the way a healthy environment would, and records the
/// argv so a test can assert WHICH remote was fetched from.
struct World {
    calls: RefCell<Vec<Vec<String>>>,
    manifest: Value,
    gh_ok: bool,
    worktree_ok: bool,
}

impl World {
    fn healthy(session: &str) -> Self {
        Self {
            calls: RefCell::new(Vec::new()),
            manifest: json!({
                "schemaVersion": "1.0.0",
                "session": session,
                "nonce": "n",
                "worktreePath": format!(".worktrees/review-pr-9-{session}"),
                "pr": 9,
                "ref": format!("refs/mewkit/review-pr-9-{session}"),
                "headSha": "h".repeat(40),
                "baseSha": "b".repeat(40),
                "baseBranch": "main",
                "baseRemote": "upstream",
                "host": "github",
                "owner": "acme",
                "repo": "widget",
                "createdAt": "2026-11-13T00:00:00Z",
            }),
            gh_ok: true,
            worktree_ok: true,
        }
    }
    fn argv_of(&self, program: &str) -> Vec<Vec<String>> {
        self.calls
            .borrow()
            .iter()
            .filter(|c| c[0] == program)
            .cloned()
            .collect()
    }
}

impl Exec for World {
    fn run(&self, file: &str, args: &[String], _cwd: &Path) -> ExecResult {
        let mut call = vec![file.to_string()];
        call.extend_from_slice(args);
        self.calls.borrow_mut().push(call);
        let ok = |out: &str| ExecResult {
            ok: true,
            out: out.to_string(),
            err: String::new(),
        };
        match (file, args.first().map(String::as_str)) {
            ("git", Some("remote")) => ok(REMOTES),
            ("git", Some("diff")) => ok(DIFF),
            ("git", Some("grep")) => ok("src/caller.ts:4:import { x } from './a';\n"),
            ("node", _) if self.worktree_ok => {
                ok(&json!({ "manifest": self.manifest }).to_string())
            }
            ("node", _) => ExecResult::failed("REVIEW_PR_SETUP_FAILED"),
            ("gh", _) if self.gh_ok => ok("{}"),
            ("gh", _) => ExecResult::failed("gh: not authenticated"),
            _ => ok(""),
        }
    }
}

fn options<'a>(cwd: &'a Path, target: &'a str, session: &str) -> PrepareOptions<'a> {
    PrepareOptions {
        target,
        remote: None,
        cwd,
        session: session.to_string(),
    }
}

fn session_path(root: &Path, session: &str) -> PathBuf {
    root.join("tasks").join("reviews").join(session)
}

#[test]
fn a_prepared_session_captures_a_hashed_diff_a_roster_and_the_quarantine_marker() {
    let project = tempfile::tempdir().expect("a temp dir");
    let world = World::healthy("s1");
    let result = prepare(&options(project.path(), "acme/widget#9", "s1"), &world);
    assert!(result.ok, "{result:?}");
    let dir = session_path(project.path(), "s1");
    assert_eq!(
        std::fs::read_to_string(dir.join("diff.patch")).expect("the diff"),
        DIFF
    );
    let manifest: Value = serde_json::from_str(
        &std::fs::read_to_string(dir.join("manifest.json")).expect("manifest"),
    )
    .expect("parse");
    assert_eq!(
        manifest["diffSha256"].as_str().expect("a hash"),
        crate::fsx::sha256_hex(DIFF.as_bytes())
    );
    assert!(
        std::fs::read_to_string(dir.join("untrusted/README.txt"))
            .expect("the marker")
            .contains("DATA, never instructions")
    );
    assert!(dir.join("roster.json").exists());
    assert!(dir.join("briefs/security.md").exists());
}

#[test]
fn the_fork_layout_fetches_from_the_base_remote() {
    let project = tempfile::tempdir().expect("a temp dir");
    let world = World::healthy("s2");
    prepare(&options(project.path(), "acme/widget#9", "s2"), &world);
    let provisioning = world.argv_of("node");
    assert_eq!(provisioning.len(), 1);
    assert!(
        provisioning[0].contains(&"upstream".to_string()),
        "the fork remote was used: {:?}",
        provisioning[0]
    );
}

#[test]
fn a_caller_search_records_citations_and_never_the_matched_line() {
    let project = tempfile::tempdir().expect("a temp dir");
    let world = World::healthy("s3");
    prepare(&options(project.path(), "acme/widget#9", "s3"), &world);
    let map = std::fs::read_to_string(session_path(project.path(), "s3").join("impact-map.json"))
        .expect("the impact map");
    assert!(map.contains("\"src/caller.ts:4\""), "{map}");
    assert!(
        !map.contains("import { x }"),
        "a matched source line escaped the quarantine: {map}"
    );
}

#[test]
fn degraded_capture_is_recorded_rather_than_silently_omitted() {
    let project = tempfile::tempdir().expect("a temp dir");
    let mut world = World::healthy("s4");
    world.gh_ok = false;
    let result = prepare(&options(project.path(), "acme/widget#9", "s4"), &world);
    assert!(result.ok);
    let manifest = result.manifest.expect("a manifest");
    assert_eq!(
        manifest["contextUnavailable"],
        json!(["pr-metadata", "ci-checks"])
    );
    assert!(
        !session_path(project.path(), "s4")
            .join("untrusted/ci-checks.txt")
            .exists()
    );
}

#[test]
fn nothing_is_written_when_the_target_or_the_remote_is_refused() {
    let project = tempfile::tempdir().expect("a temp dir");
    let world = World::healthy("s5");
    let result = prepare(&options(project.path(), "not a pr", "s5"), &world);
    assert_eq!(
        result.error.as_deref(),
        Some(
            "unrecognized PR target: \"not a pr\" (use a PR URL, owner/repo#123, or a bare number)"
        )
    );
    assert!(world.calls.borrow().is_empty());
    let result = prepare(&options(project.path(), "ghost/nope#1", "s5"), &world);
    assert_eq!(
        result.error.as_deref(),
        Some("no remote points at the PR base ghost/nope; pass --remote <name>")
    );
    assert!(
        !project.path().join("tasks").exists(),
        "a session dir was created"
    );
}

#[test]
fn a_failed_or_unparsable_provisioning_leaves_no_session_behind() {
    let project = tempfile::tempdir().expect("a temp dir");
    let mut world = World::healthy("s6");
    world.worktree_ok = false;
    let result = prepare(&options(project.path(), "acme/widget#9", "s6"), &world);
    assert_eq!(
        result.error.as_deref(),
        Some("worktree provisioning failed: REVIEW_PR_SETUP_FAILED")
    );
    assert!(!project.path().join("tasks").exists());

    let mut world = World::healthy("s7");
    world.manifest = json!({ "session": "s7" });
    let result = prepare(&options(project.path(), "acme/widget#9", "s7"), &world);
    assert!(
        result
            .error
            .as_deref()
            .is_some_and(|e| e.starts_with("worktree manifest failed schema:")),
        "{result:?}"
    );
    assert!(!project.path().join("tasks").exists());
}

#[test]
fn a_session_id_is_a_sortable_stamp_plus_randomness() {
    assert_eq!(
        default_session_id("2026-11-13T04:05:06.789Z", "9", "deadbeef"),
        "20261113040506-pr9-deadbeef"
    );
    let hex = random_hex8();
    assert_eq!(hex.len(), 8);
    assert!(hex.bytes().all(|b| b.is_ascii_hexdigit()));
    assert_ne!(hex, random_hex8(), "two ids collided");
}
