//! Which prose contradicts the lifecycle spec, and which only mentions it.
use std::fs;
use std::path::Path;

use super::super::result::Status;
use super::super::workflow_rows::check_workflow_drift;
use super::super::workflow_spec::SpecErrorKind;
use super::super::workflow_spec_load::load_workflow_spec;
use super::scan_for_violations;

const SPEC: &str = r#"
phases:
  - id: 0
    name: Orient
  - id: 1
    name: Plan
    gate: gate_1
  - id: 3
    name: Build
    substeps:
      - id: "3.5"
        name: Simplify
  - id: 4
    name: Review
    required_outputs: ["tasks/reviews/*-verdict.md"]
  - id: 6
    name: Reflect
    leads: [retro, architect]
gates:
  - id: gate_1
    required_output: "tasks/plans/*/plan.md"
  - id: gate_2
    required_output: "tasks/reviews/*-verdict.md"
contract_substep:
  required_output: "tasks/contracts/*.md"
sources:
  - path: docs/flow.md
  - path: docs/render.md
    lifecycle_render: true
"#;

fn project(prose: &[(&str, &str)]) -> tempfile::TempDir {
    let dir = tempfile::tempdir().expect("a temp dir");
    let spec_dir = dir
        .path()
        .join(".claude")
        .join("skills")
        .join("workflow-orchestrator");
    fs::create_dir_all(&spec_dir).expect("create the spec dir");
    fs::write(spec_dir.join("workflow.yaml"), SPEC).expect("write the spec");
    fs::create_dir_all(dir.path().join("docs")).expect("create the docs dir");
    for (name, body) in prose {
        fs::write(dir.path().join("docs").join(name), body).expect("write the prose");
    }
    dir
}

fn findings(dir: &Path, rel: &str, lifecycle_render: bool) -> Vec<String> {
    let spec = load_workflow_spec(dir).expect("the spec loads");
    scan_for_violations(&spec, dir, rel, lifecycle_render)
        .into_iter()
        .map(|violation| format!("{}:{} {}", violation.file, violation.line, violation.found))
        .collect()
}

#[test]
fn an_absent_spec_may_warn_but_a_broken_one_may_not() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let rows = check_workflow_drift(dir.path(), Status::Warn);
    assert_eq!(rows[0].status, Status::Warn);
    assert!(rows[0].detail.contains("run `mewkit upgrade`"));
    assert_eq!(
        check_workflow_drift(dir.path(), Status::Fail)[0].status,
        Status::Fail
    );

    let broken = project(&[]);
    fs::write(
        broken
            .path()
            .join(".claude/skills/workflow-orchestrator/workflow.yaml"),
        "phases: not-a-list\n",
    )
    .expect("break the spec");
    let rows = check_workflow_drift(broken.path(), Status::Warn);
    assert_eq!(rows[0].status, Status::Fail, "{rows:#?}");
    assert!(
        rows[0].detail.contains("malformed (no phases)"),
        "{rows:#?}"
    );
}

#[test]
fn a_source_file_that_does_not_exist_is_a_violation() {
    let dir = project(&[]);
    let found = findings(dir.path(), "docs/flow.md", false);
    assert!(
        found
            .iter()
            .any(|entry| entry.contains("missing source file")),
        "{found:?}"
    );
}

#[test]
fn a_phase_id_bound_to_another_phases_name_is_drift() {
    let dir = project(&[(
        "flow.md",
        "Canonical source: workflow.yaml\n\nPhase 4 Build happens here.\n",
    )]);
    let found = findings(dir.path(), "docs/flow.md", false);
    assert!(
        found.iter().any(|entry| entry.contains("Phase 4 Build")),
        "{found:?}"
    );
}

#[test]
fn prose_that_is_not_a_name_claim_is_left_alone() {
    let dir = project(&[(
        "flow.md",
        "Canonical source: workflow.yaml\n\nPhase 3 GREEN, Phase 2 optional, Phase 3.5 Simplify.\n",
    )]);
    assert!(findings(dir.path(), "docs/flow.md", false).is_empty());
}

#[test]
fn a_singular_output_directory_is_the_realistic_typo() {
    let dir = project(&[(
        "flow.md",
        "Canonical source: workflow.yaml\n\nVerdicts live in tasks/review/.\n",
    )]);
    let found = findings(dir.path(), "docs/flow.md", false);
    assert!(
        found.iter().any(|entry| entry.contains("tasks/review/")),
        "{found:?}"
    );
}

#[test]
fn an_output_glob_bound_to_the_wrong_gate_is_drift_unless_both_gates_are_named() {
    let dir = project(&[(
        "flow.md",
        "Canonical source: workflow.yaml\n\nGate 1 needs tasks/reviews/x-verdict.md.\n",
    )]);
    let found = findings(dir.path(), "docs/flow.md", false);
    assert_eq!(found.len(), 1, "{found:?}");

    let summary = project(&[(
        "flow.md",
        "Canonical source: workflow.yaml\n\nGate 1 and Gate 2 own tasks/reviews/x-verdict.md between them.\n",
    )]);
    assert!(findings(summary.path(), "docs/flow.md", false).is_empty());
}

#[test]
fn an_applies_to_list_must_enumerate_every_integer_phase() {
    let dir = project(&[(
        "flow.md",
        "Canonical source: workflow.yaml\n\napplies_to: [0, 1, 3]\n",
    )]);
    let found = findings(dir.path(), "docs/flow.md", false);
    assert!(
        found
            .iter()
            .any(|entry| entry.contains("applies_to omits Phase 4, 6")),
        "{found:?}"
    );
}

#[test]
fn a_file_enumerating_the_reflect_leads_must_carry_all_of_them() {
    let one = project(&[(
        "flow.md",
        "Canonical source: workflow.yaml\n\nReflect is led by retro.\n",
    )]);
    // One lead mentioned incidentally is not an enumeration.
    assert!(findings(one.path(), "docs/flow.md", false).is_empty());

    let dir = project(&[(
        "flow.md",
        "Canonical source: workflow.yaml\n\nReflect: retro and architect.\n",
    )]);
    assert!(findings(dir.path(), "docs/flow.md", false).is_empty());
}

#[test]
fn a_lifecycle_render_needs_the_sequence_marker_in_spec_order() {
    let marker = "<!-- Workflow phase sequence: 0:Orient > 1:Plan > 3:Build > 3.5:Simplify > 4:Review > 6:Reflect -->";
    let dir = project(&[(
        "render.md",
        &format!("Canonical source: workflow.yaml\n\n{marker}\n"),
    )]);
    assert!(findings(dir.path(), "docs/render.md", true).is_empty());

    let reordered = project(&[(
        "render.md",
        "Canonical source: workflow.yaml\n\n<!-- Workflow phase sequence: 1:Plan > 0:Orient -->\n",
    )]);
    let found = findings(reordered.path(), "docs/render.md", true);
    assert!(
        found.iter().any(|entry| entry.contains("reordered")),
        "{found:?}"
    );
}

#[test]
fn the_canonical_pointer_is_required_of_every_source() {
    let dir = project(&[("flow.md", "# Flow\n\nNo pointer here.\n")]);
    let found = findings(dir.path(), "docs/flow.md", false);
    assert!(
        found
            .iter()
            .any(|entry| entry.contains("missing canonical source pointer")),
        "{found:?}"
    );
}

#[test]
fn a_clean_source_set_reports_one_pass_per_source() {
    let marker = "<!-- Workflow phase sequence: 0:Orient > 1:Plan > 3:Build > 3.5:Simplify > 4:Review > 6:Reflect -->";
    let dir = project(&[
        ("flow.md", "Canonical source: workflow.yaml\n"),
        (
            "render.md",
            &format!("Canonical source: workflow.yaml\n{marker}\n"),
        ),
    ]);
    let rows = check_workflow_drift(dir.path(), Status::Warn);
    assert_eq!(rows.len(), 2);
    assert!(
        rows.iter().all(|row| row.status == Status::Pass),
        "{rows:#?}"
    );
    assert_eq!(rows[0].name, "No drift: docs/flow.md");
}

#[test]
fn a_malformed_sources_entry_is_a_spec_error_not_a_scan() {
    let dir = project(&[]);
    fs::write(
        dir.path()
            .join(".claude/skills/workflow-orchestrator/workflow.yaml"),
        "phases:\n  - id: 0\n    name: Orient\nsources:\n  - path: docs/flow.md\n    lifecycle_render: yes-please\n",
    )
    .expect("break the sources");
    let error = load_workflow_spec(dir.path()).expect_err("the spec is malformed");
    assert_eq!(error.kind, SpecErrorKind::Malformed);
    assert!(
        error.message.contains("lifecycle_render must be boolean"),
        "{}",
        error.message
    );
}
