use crate::schema::roster::ReviewTier;

use super::super::impact_map::{ChangedFile, DiffStats, FileKind, ImpactMap};
use super::{build_roster, render_brief, select_tier, write_roster};

fn map(source_changed: u64, total_changed: u64, files: Vec<ChangedFile>) -> ImpactMap {
    ImpactMap {
        changed_files: files,
        changed_exports: Vec::new(),
        removed_or_renamed: Vec::new(),
        config_keys: Vec::new(),
        production_dirs: Vec::new(),
        risk_flags: Vec::new(),
        search_terms: Vec::new(),
        scout_required: false,
        scout_reasons: Vec::new(),
        stats: DiffStats {
            source_changed,
            total_changed,
        },
        callers: None,
    }
}

fn source(path: &str, added: u64, removed: u64) -> ChangedFile {
    ChangedFile {
        path: path.to_string(),
        kind: FileKind::Source,
        deleted: false,
        added,
        removed,
        renamed_from: None,
    }
}

#[test]
fn a_small_diff_gets_the_dimension_roster_and_a_large_one_adds_territories() {
    let small = build_roster(&map(50, 60, Vec::new()));
    assert_eq!(small.tier, ReviewTier::Small);
    assert!(!small.entries.iter().any(|e| e.dimension == "territory"));

    let large = build_roster(&map(5000, 6000, vec![source("src/a.ts", 3, 1)]));
    assert_eq!(large.tier, ReviewTier::Large);
    assert!(large.entries.iter().any(|e| e.dimension == "territory"));
    assert!(large.entries.iter().any(|e| e.whole_diff == Some(true)));
}

#[test]
fn every_review_lens_is_present_in_a_small_roster() {
    let roster = build_roster(&map(50, 60, Vec::new()));
    let dimensions: Vec<&str> = roster
        .entries
        .iter()
        .map(|e| e.dimension.as_str())
        .collect();
    for lens in [
        "issue-fidelity",
        "correctness",
        "security",
        "tests",
        "build-test",
    ] {
        assert!(dimensions.contains(&lens), "{lens} is missing");
    }
}

#[test]
fn the_tier_boundaries_are_the_published_thresholds() {
    assert_eq!(
        select_tier(&DiffStats {
            source_changed: 500,
            total_changed: 3200
        }),
        ReviewTier::Small
    );
    assert_eq!(
        select_tier(&DiffStats {
            source_changed: 501,
            total_changed: 3200
        }),
        ReviewTier::Medium
    );
    assert_eq!(
        select_tier(&DiffStats {
            source_changed: 1501,
            total_changed: 0
        }),
        ReviewTier::Large
    );
    assert_eq!(
        select_tier(&DiffStats {
            source_changed: 0,
            total_changed: 6001
        }),
        ReviewTier::Large
    );
}

#[test]
fn two_files_with_the_same_slug_get_distinct_reviewer_ids() {
    // `src/a-b.ts` and `src/a_b.ts` both slug to `src-a-b`; only the path
    // digest keeps their invariant reviewers apart.
    let roster = build_roster(&map(
        200,
        200,
        vec![source("src/a-b.ts", 50, 50), source("src/a_b.ts", 50, 50)],
    ));
    let ids: Vec<&str> = roster.entries.iter().map(|e| e.id.as_str()).collect();
    let unique: std::collections::BTreeSet<&&str> = ids.iter().collect();
    assert_eq!(ids.len(), unique.len(), "duplicate reviewer id in {ids:?}");
    assert!(roster.duplicate_id().is_none());
    assert_eq!(
        roster
            .entries
            .iter()
            .filter(|e| e.dimension.starts_with("invariant:"))
            .count(),
        6
    );
}

#[test]
fn a_territory_chunk_is_capped_and_lists_its_files() {
    let files: Vec<ChangedFile> = (0..40)
        .map(|i| source(&format!("src/f{i}.ts"), 1, 1))
        .collect();
    let roster = build_roster(&map(5000, 5000, files));
    let territories: Vec<&crate::schema::roster::RosterEntry> = roster
        .entries
        .iter()
        .filter(|e| e.dimension == "territory")
        .collect();
    assert_eq!(territories.len(), 6, "the territory cap did not apply");
    assert_eq!(
        territories[0].focus.as_deref(),
        Some("Territory: src/f0.ts, src/f1.ts, src/f2.ts, src/f3.ts")
    );
}

#[test]
fn a_scout_requirement_adds_the_report_to_every_expected_read() {
    let mut impact = map(50, 60, Vec::new());
    impact.scout_required = true;
    let roster = build_roster(&impact);
    for entry in &roster.entries {
        assert_eq!(
            entry.expected_reads,
            vec![
                "diff.patch".to_string(),
                "scout-report.md".to_string(),
                entry.brief_file.clone()
            ]
        );
    }
}

#[test]
fn a_brief_names_the_wrapper_command_for_each_assigned_read() {
    let roster = build_roster(&map(50, 60, Vec::new()));
    let entry = &roster.entries[0];
    let brief = render_brief(entry, "s1");
    assert!(brief.starts_with("# Review brief — issue-fidelity\n\nSession: s1\n"));
    assert!(brief.contains("  mewkit review read --session s1 --as issue-fidelity diff.patch\n"));
    assert!(brief.contains("UNTRUSTED DATA"));
    // A whole-diff role states the focus between two blank lines.
    assert!(brief.contains("Reviewer id: issue-fidelity\n\nWhole-diff role"));
    // A role without a focus has no stray blank line.
    let plain = render_brief(
        roster
            .entries
            .iter()
            .find(|e| e.id == "security")
            .expect("security is on the roster"),
        "s1",
    );
    assert!(plain.contains("Reviewer id: security\n\n## MANDATORY"));
}

#[test]
fn writing_the_roster_materializes_one_brief_per_reviewer() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let roster = build_roster(&map(50, 60, Vec::new()));
    write_roster(dir.path(), &roster, "s1").expect("write the roster");
    let text = std::fs::read_to_string(dir.path().join("roster.json")).expect("read roster.json");
    assert!(text.starts_with("{\n  \"tier\": \"small\","));
    assert!(text.ends_with("}\n"));
    for entry in &roster.entries {
        assert!(
            dir.path().join(&entry.brief_file).exists(),
            "{} was not written",
            entry.brief_file
        );
    }
}
