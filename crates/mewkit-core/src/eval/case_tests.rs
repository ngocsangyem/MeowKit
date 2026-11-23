use super::*;
use crate::yaml_doc;

fn parse(yaml: &str) -> Result<EvalCase, String> {
    let v = yaml_doc::parse_value(yaml).map_err(|e| e.to_string())?;
    serde_json::from_value(v).map_err(|e| e.to_string())
}

fn valid(yaml: &str) -> EvalCase {
    let c = parse(yaml).expect("parses");
    c.validate().expect("valid");
    c
}

fn invalid(yaml: &str) -> String {
    parse(yaml)
        .expect("parses")
        .validate()
        .expect_err("must be refused")
        .reason
}

const TRIGGER: &str =
    "id: cook-t1\nskill: cook\nkind: trigger\nprompt: build it\nexpectTrigger: true\n";

#[test]
fn trigger_case_parses_with_defaults() {
    let c = valid(TRIGGER);
    assert_eq!(c.kind, CaseKind::Trigger);
    assert_eq!(c.runs, 3);
    assert!(!c.held_out && c.tools.is_empty() && !c.needs_judge());
}

#[test]
fn unknown_key_is_refused_so_a_typo_cannot_drop_a_check() {
    let err = parse(&format!("{TRIGGER}expectTriger: false\n")).expect_err("unknown key");
    assert!(err.contains("expectTriger"), "{err}");
}

#[test]
fn unknown_assertion_type_is_refused() {
    let yaml = "id: p\nskill: cook\nkind: paired\nprompt: x\nassertions:\n  - type: fileGone\n    path: a\n";
    assert!(parse(yaml).is_err());
}

#[test]
fn unknown_key_inside_an_assertion_is_refused() {
    let yaml = "id: p\nskill: cook\nkind: paired\nprompt: x\nassertions:\n  - type: outputMatches\n    patern: x\n";
    assert!(parse(yaml).is_err());
}

#[test]
fn trigger_without_expectation_is_refused() {
    let r = invalid("id: t\nskill: cook\nkind: trigger\nprompt: x\n");
    assert!(r.contains("expectTrigger"), "{r}");
}

#[test]
fn paired_needs_an_assertion() {
    let r = invalid("id: p\nskill: cook\nkind: paired\nprompt: x\n");
    assert!(r.contains("assertion"), "{r}");
}

#[test]
fn paired_with_model_graded_assertion_needs_judge() {
    let c = valid(
        "id: p\nskill: cook\nkind: paired\nprompt: x\nassertions:\n  - type: modelGraded\n    rubric: tests were written first\n",
    );
    assert!(c.needs_judge());
}

#[test]
fn parachute_needs_pattern_and_approach_flag() {
    assert!(
        invalid("id: q\nskill: cook\nkind: parachute\nprompt: x\napproachIsWrong: true\n")
            .contains("mismatchPattern")
    );
    assert!(
        invalid("id: q\nskill: cook\nkind: parachute\nprompt: x\nmismatchPattern: wrong\n")
            .contains("approachIsWrong")
    );
}

#[test]
fn bad_regex_is_refused() {
    let r = invalid(
        "id: q\nskill: cook\nkind: parachute\nprompt: x\napproachIsWrong: true\nmismatchPattern: '('\n",
    );
    assert!(r.contains("does not compile"), "{r}");
}

#[test]
fn bad_tool_input_pattern_is_refused() {
    let r = invalid(
        "id: q\nskill: cook\nkind: paired\nprompt: x\nassertions:\n  - { type: toolInputMatches, tool: Agent, pattern: '(' }\n",
    );
    assert!(r.contains("does not compile"), "{r}");
}

#[test]
fn fields_of_another_kind_are_refused() {
    assert!(invalid(&format!("{TRIGGER}approachIsWrong: true\n")).contains("parachute"));
}

#[test]
fn paths_must_stay_inside_the_fixture_copy() {
    for bad in ["../outside", "/etc", "a/../../b", "C:\\x"] {
        let r = invalid(&format!("{TRIGGER}fixture: '{bad}'\n"));
        assert!(r.contains("fixture"), "{bad}: {r}");
        let r = invalid(&format!(
            "id: p\nskill: cook\nkind: paired\nprompt: x\nassertions:\n  - type: fileExists\n    path: '{bad}'\n"
        ));
        assert!(r.contains("fileExists"), "{bad}: {r}");
    }
}

#[test]
fn run_count_is_bounded() {
    assert!(invalid(&format!("{TRIGGER}runs: 0\n")).contains("runs"));
    assert!(invalid(&format!("{TRIGGER}runs: 21\n")).contains("runs"));
    valid(&format!("{TRIGGER}runs: 20\n"));
}

#[test]
fn id_must_be_lowercase_slug() {
    assert!(
        invalid("id: Cook T1\nskill: cook\nkind: trigger\nprompt: x\nexpectTrigger: true\n")
            .contains("id")
    );
}

#[test]
fn negative_tool_assertions_and_git_init_parse() {
    let c = valid(
        "id: q\nskill: cook\nkind: paired\nprompt: x\ngitInit: true\nassertions:\n  - { type: toolNotCalled, tool: Agent }\n  - { type: toolInputNotMatches, tool: Bash, pattern: 'git push' }\n",
    );
    assert!(c.git_init);
    assert_eq!(c.assertions.len(), 2);
    assert!(!valid(TRIGGER).git_init, "gitInit defaults to off");
}

#[test]
fn bad_tool_input_not_matches_pattern_is_refused() {
    let reason = invalid(
        "id: q\nskill: cook\nkind: paired\nprompt: x\nassertions:\n  - { type: toolInputNotMatches, tool: Bash, pattern: '(' }\n",
    );
    assert!(reason.contains("does not compile"), "{reason}");
}
