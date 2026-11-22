//! `plan sync`: derived fields follow the Todo List boxes; human-set statuses
//! and the boxes themselves are never touched.
use std::path::PathBuf;

use super::*;
use crate::plan_doc::plan_status;

const DIR: &str = "tasks/plans/261122-demo-plan";

/// The fixture the hook core's test syncs too: `before/` synced must equal
/// `after/` byte for byte, in both implementations.
fn fixture(side: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/plan-sync")
        .join(side)
}

fn project() -> tempfile::TempDir {
    let root = tempfile::tempdir().expect("temp dir");
    let dir = root.path().join(DIR);
    std::fs::create_dir_all(&dir).expect("create the plan dir");
    for entry in std::fs::read_dir(fixture("before")).expect("read the fixture") {
        let entry = entry.expect("fixture entry");
        std::fs::copy(entry.path(), dir.join(entry.file_name())).expect("copy a fixture file");
    }
    root
}

fn read(root: &Path, name: &str) -> String {
    std::fs::read_to_string(root.join(DIR).join(name)).expect("read a plan file")
}

#[test]
fn the_shared_fixture_syncs_to_the_same_bytes_as_the_hook_core() {
    let root = project();
    let out = plan_sync(root.path(), Some(DIR), false, false);
    assert_eq!(out.code, 0, "{out:?}");
    for entry in std::fs::read_dir(fixture("after")).expect("read the expected side") {
        let entry = entry.expect("fixture entry");
        let name = entry.file_name().to_string_lossy().into_owned();
        let want = std::fs::read_to_string(entry.path()).expect("read expected");
        assert_eq!(read(root.path(), &name), want, "{name} differs after sync");
    }
    let again = plan_sync(root.path(), Some(DIR), false, false);
    assert_eq!(again.stdout, "plan sync: 261122-demo-plan already in sync");
}

#[test]
fn the_report_names_each_change_and_kept_phases_still_get_their_counts() {
    let root = project();
    let out = plan_sync(root.path(), Some(DIR), true, true);
    assert_eq!(out.code, 1, "drift exits one under --check: {out:?}");
    let report: serde_json::Value = serde_json::from_str(&out.stdout).expect("JSON report");
    assert_eq!(report["plan"], "261122-demo-plan");
    assert_eq!(report["dir"], DIR);
    assert_eq!(report["complete"], false);
    let fields: Vec<String> = report["changes"]
        .as_array()
        .expect("changes")
        .iter()
        .map(|c| {
            format!(
                "{}:{}",
                c["file"].as_str().unwrap_or(""),
                c["field"].as_str().unwrap_or("")
            )
        })
        .collect();
    assert!(
        fields.contains(&"phase-01-done.md:overview-status".to_string()),
        "{fields:?}"
    );
    assert!(
        fields.contains(&"plan.md:table-status:phase-02".to_string()),
        "{fields:?}"
    );
    assert!(
        fields.contains(&".plan-state.json:phases.phase-03-dropped.tasks_completed".to_string()),
        "{fields:?}"
    );
    assert!(
        !fields
            .iter()
            .any(|f| f.starts_with("phase-03") || f.starts_with("phase-04"))
    );
    // --check wrote nothing.
    let before = std::fs::read_to_string(fixture("before").join("plan.md")).expect("read");
    assert_eq!(read(root.path(), "plan.md"), before);
}

#[test]
fn status_names_the_drift_only_in_its_human_output() {
    let root = project();
    let hint =
        "state is behind the checkboxes: run `mewkit plan sync tasks/plans/261122-demo-plan`";
    assert!(
        plan_status(root.path(), Some(DIR), false)
            .stdout
            .ends_with(hint)
    );
    assert!(
        !plan_status(root.path(), Some(DIR), true)
            .stdout
            .contains("behind")
    );
    plan_sync(root.path(), Some(DIR), false, false);
    assert!(
        !plan_status(root.path(), Some(DIR), false)
            .stdout
            .contains("behind")
    );
}

#[test]
fn a_completed_plan_points_at_archive_and_a_kept_plan_status_stays() {
    let root = project();
    let dir = root.path().join(DIR);
    let half = read(root.path(), "phase-02-half.md").replace("- [ ] Task 2", "- [x] Task 2");
    std::fs::write(dir.join("phase-02-half.md"), half).expect("write");
    std::fs::remove_file(dir.join("phase-04-empty.md")).expect("remove");
    let out = plan_sync(root.path(), Some(DIR), false, false);
    assert!(read(root.path(), "plan.md").contains("\nstatus: completed\n"));
    assert!(
        out.stdout
            .ends_with("plan complete: run `mewkit plan archive tasks/plans/261122-demo-plan`"),
        "{}",
        out.stdout
    );
    assert!(dir.join("plan.md").exists(), "sync never archives");

    let plan = read(root.path(), "plan.md").replace("status: completed", "status: cancelled");
    std::fs::write(dir.join("plan.md"), &plan).expect("write");
    plan_sync(root.path(), Some(DIR), false, false);
    assert_eq!(read(root.path(), "plan.md"), plan);
}

#[test]
fn a_crlf_plan_keeps_its_line_endings() {
    let root = project();
    let dir = root.path().join(DIR);
    for entry in std::fs::read_dir(&dir).expect("read") {
        let path = entry.expect("entry").path();
        let text = std::fs::read_to_string(&path).expect("read");
        std::fs::write(&path, text.replace('\n', "\r\n")).expect("write");
    }
    plan_sync(root.path(), Some(DIR), false, false);
    for entry in std::fs::read_dir(fixture("after")).expect("read") {
        let entry = entry.expect("entry");
        let name = entry.file_name().to_string_lossy().into_owned();
        let want = std::fs::read_to_string(entry.path())
            .expect("read")
            .replace('\n', "\r\n");
        assert_eq!(read(root.path(), &name), want, "{name}");
    }
}

#[test]
fn a_malformed_checkpoint_is_left_alone() {
    let root = project();
    let path = root.path().join(DIR).join(".plan-state.json");
    std::fs::write(&path, "{ not json").expect("write");
    assert_eq!(plan_sync(root.path(), Some(DIR), false, false).code, 0);
    assert_eq!(std::fs::read_to_string(&path).expect("read"), "{ not json");
}

#[test]
fn a_missing_or_wrong_target_exits_one_on_stdout() {
    let root = project();
    let missing = plan_sync(root.path(), None, false, false);
    assert_eq!(
        (missing.code, missing.stdout.as_str()),
        (1, "plan sync: missing <plan-dir>")
    );
    let out = plan_sync(root.path(), Some("tasks/plans/nope"), false, false);
    assert_eq!(
        (out.code, out.stdout.as_str()),
        (1, "plan sync: not found: tasks/plans/nope")
    );
}
