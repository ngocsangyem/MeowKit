//! `validate --skill-rubric`: one row per skill, a JSON report on disk, and an
//! exit code that a low score never turns red.
mod support;

use support::temp_home::TempHome;

fn write(path: &std::path::Path, body: &str) {
    std::fs::create_dir_all(path.parent().expect("a parent")).expect("create the dir");
    std::fs::write(path, body).expect("write the file");
}

#[test]
fn low_scores_warn_and_the_report_lands_where_asked() {
    let env = TempHome::new();
    let skills = env.project().join(".claude").join("skills");
    write(
        &skills.join("good").join("SKILL.md"),
        "---\nname: mk:good\ndescription: \"Does good. NOT for mk:bad.\"\nwhen_to_use: \"Good is needed.\"\n---\nBody.\n",
    );
    write(
        &skills.join("bad").join("SKILL.md"),
        "no frontmatter; ask with AskUserQuestion\n",
    );
    let report = env.project().join("out").join("rubric.json");
    let report_arg = report.to_string_lossy().into_owned();

    let out = env.mewkit(&["validate", "--skill-rubric-report", &report_arg]);
    let stdout = String::from_utf8_lossy(&out.stdout);
    assert_eq!(out.status.code(), Some(0), "stdout: {stdout}");
    assert!(
        stdout.contains("[PASS] Skill rubric: good (6 of 6)"),
        "{stdout}"
    );
    assert!(
        stdout.contains("[WARN] Skill rubric: bad (4 of 6)"),
        "{stdout}"
    );

    let json: serde_json::Value =
        serde_json::from_slice(&std::fs::read(&report).expect("the report")).expect("JSON");
    let names: Vec<&str> = json["skills"]
        .as_array()
        .expect("a skills array")
        .iter()
        .filter_map(|s| s["skill"].as_str())
        .collect();
    assert_eq!(names, ["bad", "good"]);

    let strict = env.mewkit(&["validate", "--skill-rubric", "--strict"]);
    assert_eq!(
        strict.status.code(),
        Some(1),
        "--strict turns a WARN into exit 1"
    );
    assert!(
        env.project()
            .join(".meowkit/telemetry/skill-rubric.json")
            .is_file(),
        "without a path the report goes to the telemetry directory"
    );
}
