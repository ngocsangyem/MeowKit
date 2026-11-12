//! What can be proved about the TTY implementation WITHOUT a terminal.
//!
//! There is deliberately no `expectrl` / PTY test here. Three reasons, in order
//! of weight:
//!
//! 1. It would not be cross-platform. CI runs Linux, macOS and Windows; a PTY
//!    driver test would be skipped on Windows, so the suite would appear to
//!    cover the terminal path on every OS while covering it on two. A test whose
//!    coverage claim is false on the platform most likely to break the terminal
//!    layer is worse than its absence.
//! 2. There is nothing to drive yet. No command holds a `Prompt`, so a PTY test
//!    would have to spawn a binary written only for the test — which proves the
//!    test's own fixture works, not that `init` asks the right question.
//! 3. The terminal layer itself is `inquire`'s, tested upstream. What is OURS is
//!    the translation below: the NotTTY → flag-naming refusal mapping (so both
//!    implementations speak with one voice), the cancel mapping, and the
//!    index-based answer. Those are pure and tested here.
//!
//! When a verb wires a picker in (phase 5), the parity harness drives the real
//! binary with a non-TTY stdin, which is the case that actually regresses.

use std::io;

use inquire::error::InquireError;

use super::*;
use crate::prompt::non_tty::NonTty;
use crate::prompt::{Ask, Flag};

fn ask() -> Ask<'static> {
    Ask::new("Which runtime?", Flag::new("--target"))
}

fn targets() -> Vec<Choice> {
    vec![
        Choice::labelled("claude-code", "Claude Code").with_hint("the default"),
        Choice::plain("codex"),
    ]
}

#[test]
fn a_missing_terminal_gives_the_same_refusal_as_the_non_tty_half() {
    let translated = translate(InquireError::NotTTY, &ask(), choice_syntax(&targets()));
    assert_eq!(
        translated.to_string(),
        "no terminal: pass --target <claude-code|codex>"
    );
    // Identical text from both implementations: a command must not report a
    // different problem depending on which half it happens to hold.
    let refused = NonTty::new()
        .select(&ask(), &targets())
        .expect_err("there is no terminal");
    assert_eq!(translated, refused);
}

#[test]
fn escape_and_ctrl_c_both_cancel_the_question_by_name() {
    for error in [
        InquireError::OperationCanceled,
        InquireError::OperationInterrupted,
    ] {
        assert_eq!(
            translate(error, &ask(), None),
            PromptError::Cancelled {
                message: "Which runtime?".to_string()
            }
        );
    }
}

#[test]
fn any_other_terminal_error_is_reported_verbatim_not_as_a_cancel() {
    // A broken terminal must not look like a user declining: one is a crash to
    // report, the other is a deliberate stop.
    let translated = translate(
        InquireError::IO(io::Error::other("raw mode unavailable")),
        &ask(),
        None,
    );
    assert!(
        matches!(translated, PromptError::Io(ref detail) if detail.contains("raw mode unavailable")),
        "{translated}"
    );

    let misconfigured = translate(
        InquireError::InvalidConfiguration("no options".into()),
        &ask(),
        None,
    );
    assert!(matches!(misconfigured, PromptError::Io(_)));
}

#[test]
fn an_empty_choice_list_refuses_before_touching_the_terminal() {
    // A caller that filtered its list down to nothing gets the flag to pass,
    // not an empty picker — and no terminal is opened, which is what makes this
    // case testable at all.
    let error = Tty::new()
        .select(&ask(), &[])
        .expect_err("a picker with no options cannot be asked");
    assert_eq!(error.to_string(), "no terminal: pass --target");

    let error = Tty::new()
        .multi_select(&ask(), &[])
        .expect_err("a picker with no options cannot be asked");
    assert_eq!(error.to_string(), "no terminal: pass --target");
}

#[test]
fn a_choice_renders_its_label_and_hint_never_its_flag_value() {
    assert_eq!(
        labels(&targets()),
        vec!["Claude Code — the default", "codex"]
    );
}

#[test]
fn labels_stay_in_choice_order_so_an_index_maps_back_to_a_value() {
    // The answer comes from `raw_prompt`'s index, so this ordering IS the
    // mapping: two choices may share a label without the answer going astray.
    let choices = vec![
        Choice::labelled("a", "same label"),
        Choice::labelled("b", "same label"),
    ];
    let rendered = labels(&choices);
    assert_eq!(rendered, vec!["same label", "same label"]);
    assert_eq!(choices[1].value, "b");
}
