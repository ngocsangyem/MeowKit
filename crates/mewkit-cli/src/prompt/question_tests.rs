//! How a flag spells itself out, and what a choice carries.

use super::*;

#[test]
fn a_valueless_flag_prints_as_just_its_name() {
    assert_eq!(Flag::new("--yes").usage(None), "--yes");
}

#[test]
fn a_flags_own_syntax_wins_over_the_derived_one() {
    let flag = Flag::with_value("--delivery", "native|plugin");
    assert_eq!(
        flag.usage(Some("a|b".to_string())),
        "--delivery <native|plugin>"
    );
}

#[test]
fn a_derived_syntax_is_used_when_the_flag_declares_none() {
    assert_eq!(
        Flag::new("--target").usage(Some("claude-code|codex".to_string())),
        "--target <claude-code|codex>"
    );
}

#[test]
fn choice_syntax_lists_values_and_is_none_for_an_empty_list() {
    let choices = vec![Choice::plain("core"), Choice::labelled("review", "Review")];
    assert_eq!(choice_syntax(&choices), Some("core|review".to_string()));
    assert_eq!(choice_syntax(&[]), None);
}

#[test]
fn a_plain_choice_is_its_own_label() {
    let choice = Choice::plain("codex");
    assert_eq!(choice.label, "codex");
    assert_eq!(choice.value, "codex");
    assert_eq!(choice.hint, None);
    assert_eq!(choice.display(), "codex");
}

#[test]
fn a_hint_is_shown_after_the_label() {
    let choice = Choice::labelled("claude-code", "Claude Code").with_hint("the default");
    assert_eq!(choice.display(), "Claude Code — the default");
}
