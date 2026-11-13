//! A seeded review session on disk, for the tests of every stage after
//! `prepare`.
//!
//! The shape mirrors the npm CLI's own parity fixture: one small diff, an
//! impact map that selects the small tier, and CLI read receipts for the whole
//! rebuilt roster — so a test says what it CHANGES about a healthy session
//! rather than restating the healthy session each time.
use serde_json::{Value, json};

use super::impact_map::{DiffStats, ImpactMap};
use super::roster::{build_roster, write_roster};

pub const DIFF: &str = "diff --git a/src/a.ts b/src/a.ts\n\
     --- a/src/a.ts\n\
     +++ b/src/a.ts\n\
     @@ -1,0 +1,1 @@\n\
     +const x = 1;\n";

pub struct Seed<'a> {
    pub session: &'a str,
    /// Write `hook-evidence.jsonl` so the reads corroborate to
    /// `session-observed`.
    pub hook_corroborated: bool,
    /// A prefix the hook may have logged the target with (`./`).
    pub hook_target_prefix: &'a str,
    /// Omit every receipt for this reviewer.
    pub drop_reviewer: Option<&'a str>,
    /// Omit one (reviewer, target) receipt.
    pub drop_target: Option<(&'a str, &'a str)>,
    pub findings: Option<Value>,
    pub ci: Option<&'a str>,
    /// Append to `diff.patch` after hashing it, so the manifest hash no longer
    /// matches what is on disk.
    pub tamper_diff: bool,
    pub pr_author: Option<&'a str>,
    /// Record degraded capture in the manifest.
    pub context_unavailable: Option<Vec<String>>,
}

impl<'a> Seed<'a> {
    /// A healthy, fully-read session with no findings.
    pub fn complete(session: &'a str) -> Self {
        Self {
            session,
            hook_corroborated: false,
            hook_target_prefix: "",
            drop_reviewer: None,
            drop_target: None,
            findings: Some(json!([])),
            ci: None,
            tamper_diff: false,
            pr_author: None,
            context_unavailable: None,
        }
    }
}

pub fn impact() -> ImpactMap {
    ImpactMap {
        stats: DiffStats {
            source_changed: 40,
            total_changed: 50,
        },
        ..ImpactMap::default()
    }
}

pub fn manifest(
    session: &str,
    diff_sha256: &str,
    context_unavailable: Option<Vec<String>>,
) -> Value {
    json!({
        "schemaVersion": "1.0.0",
        "session": session,
        "nonce": "n",
        "worktreePath": format!(".worktrees/review-pr-7-{session}"),
        "pr": 7,
        "ref": format!("refs/mewkit/review-pr-7-{session}"),
        "headSha": "h".repeat(40),
        "baseSha": "b".repeat(40),
        "baseBranch": "main",
        "baseRemote": "origin",
        "host": "github",
        "owner": "o",
        "repo": "r",
        "createdAt": "2026-11-13T00:00:00Z",
        "diffSha256": diff_sha256,
        "contextUnavailable": context_unavailable,
    })
}

/// Write the session and hand back the project root that holds it.
pub fn seed_session(seed: &Seed<'_>) -> tempfile::TempDir {
    let project = tempfile::tempdir().expect("a temp dir");
    let dir = project
        .path()
        .join("tasks")
        .join("reviews")
        .join(seed.session);
    std::fs::create_dir_all(dir.join("untrusted")).expect("create the session dir");
    std::fs::write(dir.join("diff.patch"), DIFF).expect("write the diff");
    let digest = crate::fsx::sha256_hex(DIFF.as_bytes());
    if seed.tamper_diff {
        std::fs::write(dir.join("diff.patch"), format!("{DIFF}TAMPER\n")).expect("tamper");
    }
    let impact = impact();
    std::fs::write(
        dir.join("impact-map.json"),
        serde_json::to_string(&impact).expect("serialize the impact map"),
    )
    .expect("write the impact map");
    let mut manifest_value = manifest(seed.session, &digest, seed.context_unavailable.clone());
    if seed.context_unavailable.is_none() {
        manifest_value
            .as_object_mut()
            .expect("an object")
            .remove("contextUnavailable");
    }
    std::fs::write(
        dir.join("manifest.json"),
        serde_json::to_string(&manifest_value).expect("serialize the manifest"),
    )
    .expect("write the manifest");

    let roster = build_roster(&impact);
    write_roster(&dir, &roster, seed.session).expect("write the roster");

    let mut cli = String::new();
    let mut hook = String::new();
    let mut hook_seen: Vec<String> = Vec::new();
    for entry in &roster.entries {
        for target in &entry.expected_reads {
            if seed.hook_corroborated && !hook_seen.contains(target) {
                hook_seen.push(target.clone());
                hook.push_str(&format!(
                    "{}\n",
                    json!({
                        "session": seed.session,
                        "kind": "read",
                        "target": format!("{}{target}", seed.hook_target_prefix),
                        "at": "t",
                        "source": "hook",
                    })
                ));
            }
            if seed.drop_reviewer == Some(entry.id.as_str())
                || seed.drop_target == Some((entry.id.as_str(), target.as_str()))
            {
                continue;
            }
            cli.push_str(&format!(
                "{}\n",
                json!({
                    "session": seed.session,
                    "kind": "read",
                    "target": target,
                    "at": "t",
                    "reviewer": entry.id,
                    "source": "cli",
                })
            ));
        }
    }
    std::fs::write(dir.join("evidence.jsonl"), cli).expect("write the receipts");
    if seed.hook_corroborated {
        std::fs::write(dir.join("hook-evidence.jsonl"), hook).expect("write the hook receipts");
    }
    if let Some(findings) = &seed.findings {
        std::fs::write(
            dir.join("findings.json"),
            serde_json::to_string(findings).expect("serialize findings"),
        )
        .expect("write the findings");
    }
    if let Some(ci) = seed.ci {
        std::fs::write(dir.join("untrusted").join("ci-checks.txt"), ci).expect("write CI text");
    }
    if let Some(author) = seed.pr_author {
        std::fs::write(
            dir.join("untrusted").join("pr-metadata.json"),
            json!({ "author": { "login": author } }).to_string(),
        )
        .expect("write PR metadata");
    }
    project
}
