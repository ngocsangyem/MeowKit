//! Pack coherence, and the safety invariant that is not negotiable.
use std::fs;
use std::path::Path;

use super::super::result::Status;
use super::check_packs;

/// A kit with one skill and a manifest whose base is `<globs>`.
fn install(manifest: &str) -> tempfile::TempDir {
    let dir = tempfile::tempdir().expect("a temp dir");
    let claude = dir.path().join(".claude");
    let skill = claude.join("skills").join("cook");
    fs::create_dir_all(&skill).expect("create the skill dir");
    fs::write(
        skill.join("SKILL.md"),
        "---\nname: mk:cook\nowner: lifecycle\n---\n",
    )
    .expect("write the skill");
    let meowkit = dir.path().join(".meowkit");
    fs::create_dir_all(&meowkit).expect("create the state dir");
    fs::write(meowkit.join("pack-manifest.json"), manifest).expect("write the manifest");
    dir
}

fn claude(dir: &Path) -> std::path::PathBuf {
    dir.join(".claude")
}

fn detail_of<'a>(rows: &'a [super::super::CheckResult], name: &str) -> Option<&'a str> {
    rows.iter()
        .find(|row| row.name == name)
        .map(|row| row.detail.as_str())
}

#[test]
fn an_absent_manifest_takes_the_severity_the_caller_asked_for() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let lenient = check_packs(&claude(dir.path()), Status::Warn);
    assert_eq!(lenient.len(), 1);
    assert_eq!(lenient[0].status, Status::Warn);
    assert!(lenient[0].detail.contains("run `mewkit upgrade`"));
    let strict = check_packs(&claude(dir.path()), Status::Fail);
    assert_eq!(strict[0].status, Status::Fail);
}

#[test]
fn a_malformed_manifest_fails_with_the_loaders_own_message() {
    let dir = install("{ not json");
    let rows = check_packs(&claude(dir.path()), Status::Fail);
    assert_eq!(rows[0].name, "Pack manifest loads");
    assert!(
        rows[0]
            .detail
            .starts_with("pack-manifest.json is not valid JSON")
    );

    let shapeless = install(r#"{"base":{},"packs":{},"profiles":{}}"#);
    let rows = check_packs(&claude(shapeless.path()), Status::Fail);
    assert_eq!(
        rows[0].detail,
        "manifest.base must have array fields files/globs"
    );
}

#[test]
fn a_profile_referencing_nothing_is_reported_by_name() {
    let dir =
        install(r#"{"base":{"files":[],"globs":[]},"packs":{},"profiles":{"core":["ghost"]}}"#);
    let rows = check_packs(&claude(dir.path()), Status::Fail);
    assert!(
        rows.iter().any(|row| row.name == "Profile resolves: core"
            && row.detail.contains("unknown pack/profile \"ghost\"")),
        "{rows:#?}"
    );
}

#[test]
fn a_phantom_override_id_is_caught() {
    let dir = install(
        r#"{"base":{"files":[],"globs":[]},"packs":{"dev":{"owners":["lifecycle"],"artifactsAdd":["mk:ghost"]}},"profiles":{}}"#,
    );
    let rows = check_packs(&claude(dir.path()), Status::Fail);
    assert_eq!(
        detail_of(&rows, "Pack override id: dev"),
        Some("references unknown artifact id \"mk:ghost\"")
    );
}

#[test]
fn an_artifact_in_no_pack_and_no_base_is_a_stray() {
    let dir = install(r#"{"base":{"files":[],"globs":[]},"packs":{},"profiles":{}}"#);
    let rows = check_packs(&claude(dir.path()), Status::Fail);
    assert_eq!(
        detail_of(&rows, "Pack completeness"),
        Some("1 artifact(s) in no pack/base: mk:cook(lifecycle)")
    );
}

#[test]
fn the_safety_invariant_names_every_file_base_is_missing() {
    let dir = install(
        r#"{"base":{"files":["statusline.cjs"],"globs":[]},"packs":{"core":{"owners":["lifecycle"]}},"profiles":{"core":["core"]}}"#,
    );
    let rows = check_packs(&claude(dir.path()), Status::Fail);
    let detail = detail_of(&rows, "Base safety invariant").expect("the safety row");
    assert!(detail.starts_with("base missing required safety file(s): "));
    // The one file base DOES carry is not listed; the gate chain is.
    assert!(!detail.contains("statusline.cjs"), "{detail}");
    assert!(detail.contains("hooks/gate-enforcement.cjs"), "{detail}");
    assert!(detail.contains("rules/injection-rules.md"), "{detail}");
}

#[test]
fn a_base_glob_expands_against_the_tree() {
    // `skills/**` pulls the skill file in, so it is no longer a stray.
    let dir = install(r#"{"base":{"files":[],"globs":["skills/**"]},"packs":{},"profiles":{}}"#);
    let rows = check_packs(&claude(dir.path()), Status::Fail);
    assert_eq!(detail_of(&rows, "Pack completeness"), None, "{rows:#?}");
}

#[test]
fn an_unresolvable_dependency_is_named_with_its_holder() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let skill = dir.path().join(".claude").join("skills").join("cook");
    fs::create_dir_all(&skill).expect("create the skill dir");
    fs::write(
        skill.join("SKILL.md"),
        "---\nname: mk:cook\nowner: lifecycle\ndepends_on: [mk:ghost]\n---\n",
    )
    .expect("write the skill");
    let meowkit = dir.path().join(".meowkit");
    fs::create_dir_all(&meowkit).expect("create the state dir");
    fs::write(
        meowkit.join("pack-manifest.json"),
        r#"{"base":{"files":[],"globs":["skills/**"]},"packs":{},"profiles":{}}"#,
    )
    .expect("write the manifest");
    let rows = check_packs(&claude(dir.path()), Status::Fail);
    assert_eq!(
        detail_of(&rows, "depends_on: mk:cook"),
        Some("unresolvable dependency \"mk:ghost\"")
    );
}

#[test]
fn an_inventory_with_no_edges_at_all_warns_that_the_closure_is_inert() {
    let dir = install(r#"{"base":{"files":[],"globs":["skills/**"]},"packs":{},"profiles":{}}"#);
    let rows = check_packs(&claude(dir.path()), Status::Fail);
    assert!(
        rows.iter()
            .any(|row| row.name == "depends_on edges" && row.status == Status::Warn),
        "{rows:#?}"
    );
}
