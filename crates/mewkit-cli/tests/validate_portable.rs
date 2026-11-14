//! `validate --portable`: the provider-contract matrix, and what it says about a
//! Codex tree in the project.
//!
//! A Codex tree is checked by `--target codex`, which reads what an install
//! actually writes, so `--portable` names that check as an N/A row instead of
//! re-deriving a skill count an install filtered by packs would never match.
mod support;

use support::temp_home::TempHome;

#[test]
fn a_codex_tree_under_portable_points_at_the_target_check() {
    let env = TempHome::new();
    let project = env.project();
    std::fs::create_dir_all(project.join(".claude").join("rules")).expect("create .claude/rules");
    std::fs::create_dir_all(project.join(".codex")).expect("create the codex tree");

    let out = env.mewkit(&["validate", "--mode", "flat-copy", "--portable"]);
    let stdout = String::from_utf8_lossy(&out.stdout);
    // A report, and an honest non-zero code for an install this incomplete;
    // never the usage error a refusal would give.
    assert_eq!(out.status.code(), Some(1), "stdout: {stdout}");
    assert!(
        stdout.contains("Codex projection") && stdout.contains("--target codex"),
        "the row must name where the Codex check lives: {stdout}"
    );
}

#[test]
fn portable_without_a_codex_tree_reports_the_surface_matrix_alone() {
    let env = TempHome::new();
    std::fs::create_dir_all(env.project().join(".claude").join("rules"))
        .expect("create .claude/rules");
    let out = env.mewkit(&["validate", "--mode", "flat-copy", "--portable"]);
    let stdout = String::from_utf8_lossy(&out.stdout);
    assert_eq!(
        stdout.matches("Provider contract: ").count(),
        18,
        "stdout: {stdout}"
    );
    assert!(!stdout.contains("Codex projection"), "stdout: {stdout}");
}
