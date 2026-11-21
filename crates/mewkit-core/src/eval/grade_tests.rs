use super::*;
use crate::fsx::RelPath;

fn t(events: Vec<Event>, final_text: &str) -> Transcript {
    Transcript {
        events,
        final_text: final_text.into(),
        listed_skills: None,
        cost_usd: None,
        tokens: None,
    }
}

fn load(s: &str) -> Event {
    Event::SkillLoad(s.into())
}

fn tool(s: &str) -> Event {
    tool_with(s, "")
}

fn tool_with(name: &str, input: &str) -> Event {
    Event::Tool {
        name: name.into(),
        input: input.into(),
    }
}

/// An in-memory workspace: exact paths only, which is all these tests need.
struct Files(Vec<(&'static str, &'static str)>);

impl Workspace for Files {
    fn read_matching(&self, pattern: &RelPath) -> Vec<String> {
        self.0
            .iter()
            .filter(|(p, _)| *p == pattern.as_str())
            .map(|(_, c)| (*c).to_owned())
            .collect()
    }
}

#[allow(non_upper_case_globals)]
const no_files: Files = Files(Vec::new());

fn case(kind: CaseKind) -> EvalCase {
    EvalCase {
        id: "c".into(),
        skill: "cook".into(),
        kind,
        prompt: "p".into(),
        runs: 1,
        suite: "baseline".into(),
        fixture: None,
        tools: vec![],
        held_out: false,
        expect_trigger: None,
        approach_is_wrong: None,
        mismatch_pattern: None,
        assertions: vec![],
    }
}

#[test]
fn trigger_hit_needs_the_load_before_any_other_tool() {
    assert!(trigger_hit(
        "cook",
        &t(vec![load("cook"), tool("Bash")], "")
    ));
    assert!(trigger_hit(
        "mk:cook",
        &t(vec![load("plan-creator"), load("cook")], "")
    ));
    // Found by search after a listing miss: not a trigger.
    assert!(!trigger_hit(
        "cook",
        &t(vec![tool("shell"), load("cook")], "")
    ));
    assert!(!trigger_hit("cook", &t(vec![], "")));
}

#[test]
fn trigger_case_passes_when_hit_matches_expectation() {
    let mut c = case(CaseKind::Trigger);
    c.expect_trigger = Some(true);
    assert_eq!(
        grade_run(&c, &t(vec![load("cook")], ""), &no_files),
        Verdict::Pass
    );
    assert_eq!(
        grade_run(&c, &t(vec![tool("Bash")], ""), &no_files),
        Verdict::Fail
    );
    c.expect_trigger = Some(false);
    assert_eq!(
        grade_run(&c, &t(vec![tool("Bash")], ""), &no_files),
        Verdict::Pass
    );
    assert_eq!(
        grade_run(&c, &t(vec![load("cook")], ""), &no_files),
        Verdict::Fail
    );
}

#[test]
fn parachute_reports_on_wrong_approach_and_stays_quiet_on_control() {
    let mut c = case(CaseKind::Parachute);
    c.mismatch_pattern = Some("(?i)contradicts the goal".into());
    c.approach_is_wrong = Some(true);
    let reported = t(vec![], "This approach Contradicts the goal.");
    let quiet = t(vec![], "Done.");
    assert_eq!(grade_run(&c, &reported, &no_files), Verdict::Pass);
    assert_eq!(grade_run(&c, &quiet, &no_files), Verdict::Fail);
    c.approach_is_wrong = Some(false);
    assert_eq!(
        grade_run(&c, &reported, &no_files),
        Verdict::Fail,
        "false report on control"
    );
    assert_eq!(grade_run(&c, &quiet, &no_files), Verdict::Pass);
}

#[test]
fn each_assertion_has_a_pass_and_a_fail() {
    let run = t(
        vec![load("cook"), tool("Write"), tool("Bash")],
        "all tests pass",
    );
    let has_flag = Files(vec![("src/flag.rs", "pub fn flag() -> bool { true }")]);
    let cases = [
        (
            Assertion::SkillLoaded {
                skill: "cook".into(),
            },
            Assertion::SkillLoaded {
                skill: "fix".into(),
            },
        ),
        (
            Assertion::SkillNotLoaded {
                skill: "fix".into(),
            },
            Assertion::SkillNotLoaded {
                skill: "mk:cook".into(),
            },
        ),
        (
            Assertion::FileExists {
                path: "src/flag.rs".into(),
            },
            Assertion::FileExists {
                path: "src/other.rs".into(),
            },
        ),
        (
            Assertion::FileContains {
                path: "src/flag.rs".into(),
                pattern: r"fn flag\(\)".into(),
            },
            Assertion::FileContains {
                path: "src/flag.rs".into(),
                pattern: "false".into(),
            },
        ),
        (
            Assertion::OutputMatches {
                pattern: "tests pass".into(),
            },
            Assertion::OutputMatches {
                pattern: "^fail".into(),
            },
        ),
        (
            Assertion::OutputNotMatches {
                pattern: "error".into(),
            },
            Assertion::OutputNotMatches {
                pattern: "pass".into(),
            },
        ),
        (
            Assertion::ToolBefore {
                first: "Write".into(),
                then: "Bash".into(),
            },
            Assertion::ToolBefore {
                first: "Bash".into(),
                then: "Write".into(),
            },
        ),
    ];
    for (pass, fail) in cases {
        assert_eq!(
            grade::grade_assertion(&pass, &run, &has_flag),
            Verdict::Pass,
            "{pass:?}"
        );
        assert_eq!(
            grade::grade_assertion(&fail, &run, &has_flag),
            Verdict::Fail,
            "{fail:?}"
        );
    }
}

#[test]
fn tool_before_fails_when_either_tool_is_missing() {
    let run = t(vec![tool("Write")], "");
    let a = Assertion::ToolBefore {
        first: "Write".into(),
        then: "Bash".into(),
    };
    assert_eq!(grade::grade_assertion(&a, &run, &no_files), Verdict::Fail);
}

#[test]
fn model_graded_is_left_to_the_judge_unless_another_assertion_fails() {
    let mut c = case(CaseKind::Paired);
    c.assertions = vec![
        Assertion::ModelGraded { rubric: "r".into() },
        Assertion::SkillLoaded {
            skill: "cook".into(),
        },
    ];
    assert_eq!(
        grade_run(&c, &t(vec![load("cook")], ""), &no_files),
        Verdict::NeedsJudge
    );
    assert_eq!(grade_run(&c, &t(vec![], ""), &no_files), Verdict::Fail);
}

#[test]
fn tool_input_matches_checks_the_input_of_the_named_tool() {
    let t = t(
        vec![
            tool_with("Bash", r#"{"command":"Goal: x"}"#),
            tool_with("Agent", r#"{"prompt":"Goal: fix\nReturn: summary"}"#),
        ],
        "",
    );
    let ws = Files(vec![]);
    let hit = |tool: &str, pattern: &str| {
        grade::grade_assertion(
            &Assertion::ToolInputMatches {
                tool: tool.into(),
                pattern: pattern.into(),
            },
            &t,
            &ws,
        )
    };
    assert_eq!(hit("Agent", r"Goal:.*Return:"), Verdict::Pass);
    // Either spelling names the subagent tool.
    assert_eq!(hit("Task", r"Goal:.*Return:"), Verdict::Pass);
    // Another tool's input does not count, and a mismatch fails.
    assert_eq!(hit("Bash", r"Return:"), Verdict::Fail);
    assert_eq!(hit("Edit", r"Goal"), Verdict::Fail);
}
