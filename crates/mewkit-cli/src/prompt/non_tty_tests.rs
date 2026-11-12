//! Every prompt kind must refuse with the flag that answers it. These are the
//! cases phase 5's criterion rests on: "every TUI picker has a flag equivalent;
//! a non-TTY run without the flag exits non-zero and names it".

use super::*;
use crate::failure::{Failure, USAGE};
use crate::prompt::{Ask, Flag};

fn targets() -> Vec<Choice> {
    vec![
        Choice::plain("claude-code"),
        Choice::plain("codex"),
        Choice::plain("cursor"),
    ]
}

#[test]
fn select_names_the_flag_and_the_values_it_accepts() {
    let ask = Ask::new("Which runtime?", Flag::new("--target"));
    let error = NonTty::new()
        .select(&ask, &targets())
        .expect_err("there is no terminal");
    assert_eq!(
        error.to_string(),
        "no terminal: pass --target <claude-code|codex|cursor>"
    );
}

#[test]
fn multi_select_names_the_flag_and_the_values_it_accepts() {
    let ask = Ask::new("Which runtimes?", Flag::new("--target"));
    let error = NonTty::new()
        .multi_select(&ask, &targets())
        .expect_err("there is no terminal");
    assert_eq!(
        error.to_string(),
        "no terminal: pass --target <claude-code|codex|cursor>"
    );
}

#[test]
fn confirm_names_the_valueless_flag() {
    let ask = Ask::new("Remove the kit?", Flag::new("--yes"));
    let error = NonTty::new()
        .confirm(&ask, false)
        .expect_err("there is no terminal");
    assert_eq!(error.to_string(), "no terminal: pass --yes");
}

#[test]
fn confirm_ignores_its_default_rather_than_agreeing_unattended() {
    let ask = Ask::new("Remove the kit?", Flag::new("--yes"));
    // A `true` default must NOT become a silent yes: an unattended run would
    // then agree to something it was never asked about.
    assert!(NonTty::new().confirm(&ask, true).is_err());
}

#[test]
fn text_names_the_flag_and_a_value_placeholder() {
    let ask = Ask::new("Which profile?", Flag::new("--profile"));
    let error = NonTty::new()
        .text(&ask, Some("full"))
        .expect_err("there is no terminal");
    assert_eq!(error.to_string(), "no terminal: pass --profile <value>");
}

#[test]
fn an_explicit_value_syntax_overrides_the_derived_one() {
    let ask = Ask::new(
        "How should it be delivered?",
        Flag::with_value("--delivery", "native|plugin"),
    );
    let error = NonTty::new()
        .select(&ask, &[Choice::plain("a"), Choice::plain("b")])
        .expect_err("there is no terminal");
    assert_eq!(
        error.to_string(),
        "no terminal: pass --delivery <native|plugin>"
    );
}

#[test]
fn a_choice_label_never_leaks_into_the_flag_syntax() {
    // The flag accepts the VALUE; the label is for the person reading the
    // picker. A refusal naming the label would tell the caller to pass
    // something the parser rejects.
    let ask = Ask::new("Which runtime?", Flag::new("--target"));
    let choices = vec![
        Choice::labelled("claude-code", "Claude Code").with_hint("the default"),
        Choice::labelled("codex", "Codex"),
    ];
    let error = NonTty::new()
        .select(&ask, &choices)
        .expect_err("there is no terminal");
    assert_eq!(
        error.to_string(),
        "no terminal: pass --target <claude-code|codex>"
    );
}

#[test]
fn a_question_with_no_choices_still_names_its_flag() {
    let ask = Ask::new("Which pack?", Flag::new("--packs"));
    let error = NonTty::new()
        .select(&ask, &[])
        .expect_err("there is no terminal");
    assert_eq!(error.to_string(), "no terminal: pass --packs");
}

#[test]
fn a_missing_flag_exits_as_a_usage_error() {
    let ask = Ask::new("Which runtime?", Flag::new("--target"));
    let failure: Failure = NonTty::new()
        .select(&ask, &targets())
        .expect_err("there is no terminal")
        .into();
    assert_eq!(failure.code, USAGE);
    assert_eq!(
        failure.message,
        "no terminal: pass --target <claude-code|codex|cursor>"
    );
}

#[test]
fn a_cancelled_or_broken_prompt_exits_as_a_plain_failure() {
    let cancelled: Failure = PromptError::Cancelled {
        message: "Which runtime?".into(),
    }
    .into();
    assert_eq!(cancelled.code, crate::failure::FAILED);
    assert_eq!(cancelled.message, "cancelled: Which runtime?");

    let broken: Failure = PromptError::Io("raw mode unavailable".into()).into();
    assert_eq!(broken.message, "prompt failed: raw mode unavailable");
}

#[test]
fn the_trait_is_usable_behind_a_reference_so_a_command_can_hold_either_half() {
    // Object safety is the point: a command takes `&mut dyn Prompt` and the
    // caller decides which implementation it gets.
    let mut prompt = NonTty::new();
    let picker: &mut dyn Prompt = &mut prompt;
    let ask = Ask::new("Which runtime?", Flag::new("--target"));
    assert!(picker.select(&ask, &targets()).is_err());
}
