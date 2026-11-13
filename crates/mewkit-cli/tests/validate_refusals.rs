//! The one `validate` path this binary still refuses, and how it refuses.
//!
//! Every flag and both modes are ported; the single gap is the Codex
//! PROJECTION rows under `--portable`, which count the skills a provider may
//! carry and therefore need the portability-policy engine. A project that has
//! a generated Codex tree is refused BY NAME rather than reported on partially,
//! because a partial report that exited 0 would be read by a CI step as a full
//! pass — the one answer a validator must never give.
//!
//! The refusal exits 2 (a usage error), never 1: exit 1 is `validate`'s "this
//! project has a problem", and a missing implementation is not a finding about
//! the project.
mod support;

use support::temp_home::TempHome;

#[test]
fn a_generated_codex_tree_under_portable_is_refused_by_name() {
    let env = TempHome::new();
    let project = env.project();
    std::fs::create_dir_all(project.join(".claude").join("rules")).expect("create .claude/rules");
    std::fs::create_dir_all(project.join(".codex")).expect("create the projected tree");

    let out = env.mewkit_next(&["validate", "--mode", "flat-copy", "--portable"]);
    assert_eq!(
        out.status.code(),
        Some(2),
        "stderr: {}",
        String::from_utf8_lossy(&out.stderr)
    );
    let stderr = String::from_utf8_lossy(&out.stderr);
    assert!(
        stderr.contains("Codex projection rows")
            && stderr.contains("npx mewkit validate --portable"),
        "a refusal must name the check and the way out: {stderr}"
    );
}

#[test]
fn the_same_project_without_portable_is_validated_normally() {
    let env = TempHome::new();
    let project = env.project();
    std::fs::create_dir_all(project.join(".claude").join("rules")).expect("create .claude/rules");
    std::fs::create_dir_all(project.join(".codex")).expect("create the projected tree");

    let out = env.mewkit_next(&["validate", "--mode", "flat-copy"]);
    // A report, and an honest non-zero code for an install this incomplete.
    assert_eq!(out.status.code(), Some(1));
    assert!(
        String::from_utf8_lossy(&out.stdout).contains("Directory exists: agents"),
        "the run must produce its report rather than refuse"
    );
}

#[test]
fn portable_without_a_projected_tree_reports_the_surface_matrix() {
    let env = TempHome::new();
    std::fs::create_dir_all(env.project().join(".claude").join("rules"))
        .expect("create .claude/rules");
    let out = env.mewkit_next(&["validate", "--mode", "flat-copy", "--portable"]);
    let stdout = String::from_utf8_lossy(&out.stdout);
    assert_eq!(
        stdout.matches("Provider contract: ").count(),
        18,
        "stdout: {stdout}"
    );
}
