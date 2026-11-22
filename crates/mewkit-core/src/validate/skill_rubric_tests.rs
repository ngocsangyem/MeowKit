//! Each rubric criterion against a small fixture, and the shipped kit as a whole.
use std::fs;
use std::path::Path;

use super::super::result::Status;
use super::super::skill_rubric_report::{failures, skill_rubric_rows};
use super::*;

fn kit(files: &[(&str, &str)]) -> tempfile::TempDir {
    let dir = tempfile::tempdir().expect("a temp dir");
    for (rel, body) in files {
        let path = dir.path().join(".claude").join(rel);
        fs::create_dir_all(path.parent().expect("a parent")).expect("create the dir");
        fs::write(path, body).expect("write a file");
    }
    dir
}

fn skill_md(description: &str, when: &str, body: &str) -> String {
    format!("---\nname: mk:x\ndescription: \"{description}\"\nwhen_to_use: \"{when}\"\n---\n{body}")
}

fn words(n: usize, seed: &str) -> String {
    (0..n)
        .map(|i| format!("{seed}{i}"))
        .collect::<Vec<_>>()
        .join(" ")
}

#[test]
fn description_needs_what_when_and_when_not() {
    let full = measure_description(&skill_md("Fixes bugs. NOT for mk:y.", "A test fails.", ""));
    assert!(full.states_what && full.states_when && full.states_when_not);

    let no_not = measure_description(&skill_md("Fixes bugs.", "A test fails.", ""));
    assert!(!no_not.states_when_not);

    let no_when = measure_description("---\ndescription: \"Fixes bugs. NOT for mk:y.\"\n---\n");
    assert!(
        !no_when.states_when,
        "no when_to_use and no 'when' in the text"
    );

    let only_not = measure_description(&skill_md("NOT for mk:y.", "A test fails.", ""));
    assert!(
        !only_not.states_what,
        "naming what it is not says nothing on its own"
    );

    let none = measure_description("no frontmatter at all");
    assert_eq!(none, DescriptionMeasure::default());
}

#[test]
fn description_over_the_listing_limit_fails() {
    let long = "a".repeat(DESCRIPTION_MAX_CHARS + 1);
    let row = SkillRubricRow {
        description: measure_description(&skill_md(&format!("{long} NOT for y"), "when", "")),
        ..SkillRubricRow::default()
    };
    assert!(!row.pass_description());
    assert!(failures(&row)[0].contains("listing chars"));
}

#[test]
fn entry_tokens_are_chars_over_four_rounded_up() {
    let entry = measure_entry("abcde\nfg\n");
    assert_eq!((entry.chars, entry.lines, entry.tokens), (9, 2, 3));
    let big = SkillRubricRow {
        entry: measure_entry(&"x".repeat(ENTRY_MAX_TOKENS * CHARS_PER_TOKEN + 1)),
        ..SkillRubricRow::default()
    };
    assert!(!big.pass_entry());
    let fits = SkillRubricRow {
        entry: measure_entry(&"x".repeat(ENTRY_MAX_TOKENS * CHARS_PER_TOKEN)),
        ..SkillRubricRow::default()
    };
    assert!(fits.pass_entry());
}

#[test]
fn emphasis_counts_words_and_caps_bold_once() {
    let text = skill_md(
        "d",
        "w",
        "You MUST do it. **IMPORTANT:** read. **HARD GATE** here. **Note** and must.",
    );
    let e = measure_emphasis(&text);
    // MUST, IMPORTANT (its bold span not counted again), HARD GATE.
    assert_eq!(e.marks, 3);
    assert_eq!(e.words, 12);
    assert!(e.per_1000_words() > EMPHASIS_MAX_PER_1000_WORDS);
    assert_eq!(EmphasisMeasure::default().per_1000_words(), 0.0);
}

#[test]
fn harness_tool_without_a_fallback_is_flagged() {
    let bare = "---\nallowed-tools:\n  - AskUserQuestion\n---\nUse AskUserQuestion to confirm.\n";
    assert_eq!(
        unhedged_tool_names(bare),
        vec![(5, "AskUserQuestion".to_string())]
    );

    let hedged =
        "---\n---\nCall Agent(planner).\nWhere that tool is unavailable, run the steps inline.\n";
    assert!(unhedged_tool_names(hedged).is_empty());

    let far = format!(
        "Track it with TodoWrite.\n{}On other runtimes, keep a checklist.\n",
        "line\n".repeat(FALLBACK_WINDOW + 1)
    );
    assert_eq!(
        unhedged_tool_names(&far).len(),
        1,
        "the fallback is out of reach"
    );

    assert!(unhedged_tool_names("A Task (optional) and an Agent mention.").is_empty());
}

#[test]
fn a_paragraph_copied_into_another_skill_is_a_duplicate() {
    let shared = words(DUPLICATE_MIN_WORDS, "w");
    let short = words(DUPLICATE_MIN_WORDS - 1, "s");
    let dir = kit(&[
        (
            "skills/a/SKILL.md",
            &format!("intro\n\n{shared}\n\n{short}\n"),
        ),
        ("skills/b/references/r.md", &format!("{shared}\n")),
        ("skills/b/SKILL.md", &short),
        ("skills/c/SKILL.md", "alone"),
        ("skills/c/eval/case.md", &shared),
    ]);
    let rows = score_skills(&dir.path().join(".claude"));
    let by_name = |n: &str| rows.iter().find(|r| r.skill == n).expect("a row");
    assert_eq!(by_name("a").duplicates.passages, 1);
    assert_eq!(by_name("a").duplicates.shared_with, vec!["b".to_string()]);
    assert_eq!(by_name("b").duplicates.passages, 1);
    assert!(
        by_name("c").pass_duplicates(),
        "eval data is not skill text"
    );
}

#[test]
fn shared_family_copies_are_not_duplicates() {
    let shared = words(DUPLICATE_MIN_WORDS, "w");
    let manifest = r#"{"families":[{"name":"p","canonical":"skills/a/references/p.md",
      "members":["skills/b/references/p.md"]}]}"#;
    let dir = kit(&[
        ("shared-families.json", manifest),
        ("skills/a/SKILL.md", "a"),
        ("skills/a/references/p.md", &shared),
        ("skills/b/SKILL.md", "b"),
        ("skills/b/references/p.md", &shared),
    ]);
    let rows = score_skills(&dir.path().join(".claude"));
    assert!(rows.iter().all(SkillRubricRow::pass_duplicates));
}

#[test]
fn a_link_to_a_missing_file_is_a_dead_reference() {
    let dir = kit(&[
        (
            "skills/a/SKILL.md",
            "See [the guide](references/missing.md).\n",
        ),
        ("skills/b/SKILL.md", "Nothing linked.\n"),
    ]);
    let rows = score_skills(&dir.path().join(".claude"));
    assert_eq!(rows[0].dead_references.len(), 1);
    assert!(rows[0].dead_references[0].starts_with("skills/a/SKILL.md:1:"));
    assert!(rows[1].pass_references());
}

#[test]
fn rows_warn_but_never_fail() {
    let dir = kit(&[
        (
            "skills/good/SKILL.md",
            &skill_md("Fixes bugs. NOT for mk:y.", "Broken.", "Body."),
        ),
        (
            "skills/bad/SKILL.md",
            "no frontmatter, IMPORTANT MUST NEVER",
        ),
    ]);
    let scored = score_skills(&dir.path().join(".claude"));
    let rows = skill_rubric_rows(&scored);
    let status = |n: &str| {
        rows.iter()
            .find(|r| r.name.contains(n))
            .expect("a row")
            .status
    };
    assert_eq!(status("good (6 of 6)"), Status::Pass);
    assert_eq!(status("bad (4 of 6)"), Status::Warn);
    assert!(rows.iter().all(|r| r.status != Status::Fail));

    let empty = kit(&[("skills/README.md", "x")]);
    let none = skill_rubric_rows(&score_skills(&empty.path().join(".claude")));
    assert_eq!(none[0].status, Status::Na);
}

#[test]
fn the_report_has_one_entry_per_skill_with_each_value() {
    let dir = kit(&[(
        "skills/a/SKILL.md",
        &skill_md("Does a. NOT for b.", "w", "x"),
    )]);
    let report = super::super::skill_rubric_report::skill_rubric_report(&score_skills(
        &dir.path().join(".claude"),
    ));
    let skill = &report["skills"][0];
    assert_eq!(skill["skill"], "a");
    assert_eq!(skill["score"], CRITERIA);
    for key in [
        "description",
        "entry",
        "dead_references",
        "emphasis",
        "harness_tools",
    ] {
        assert_eq!(skill[key]["pass"], true, "{key}");
    }
    assert_eq!(report["thresholds"]["entry_max_tokens"], ENTRY_MAX_TOKENS);
}

#[test]
fn every_shipped_skill_gets_a_row() {
    let claude = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../.claude");
    let skills = claude.join("skills");
    let mut expected: Vec<String> = fs::read_dir(&skills)
        .expect("the kit's skills")
        .filter_map(Result::ok)
        .filter(|e| e.path().join("SKILL.md").is_file())
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .collect();
    expected.sort();
    let rows = score_skills(&claude);
    let got: Vec<String> = rows.iter().map(|r| r.skill.clone()).collect();
    assert_eq!(got, expected);
    assert!(rows.len() > 100, "the kit ships over a hundred skills");
    let printed = skill_rubric_rows(&rows);
    assert_eq!(printed.len(), rows.len());
    assert!(printed.iter().all(|r| r.status != Status::Fail));
}
