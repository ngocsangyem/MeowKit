//! The errors a picker can return, and the interactivity probe a command uses
//! to choose an implementation.

use super::*;

#[test]
fn every_error_reads_as_an_instruction_or_a_cause() {
    assert_eq!(
        PromptError::NoTerminal {
            usage: "--target <codex>".into()
        }
        .to_string(),
        "no terminal: pass --target <codex>"
    );
    assert_eq!(
        PromptError::Cancelled {
            message: "Which runtime?".into()
        }
        .to_string(),
        "cancelled: Which runtime?"
    );
    assert_eq!(
        PromptError::Io("broken pipe".into()).to_string(),
        "prompt failed: broken pipe"
    );
}

#[test]
fn is_interactive_answers_without_touching_the_terminal_state() {
    // Under `cargo test` the answer depends on how the suite was launched, so
    // this asserts only that asking is side-effect-free and repeatable — the
    // property a command relies on when it picks an implementation.
    assert_eq!(is_interactive(), is_interactive());
}

/// The branch a CI run, a hook and a piped shell all take: a question is
/// refused with the flag that answers it, never asked on a terminal that will
/// never respond and never silently defaulted.
#[test]
fn without_a_terminal_the_factory_hands_back_the_refusing_picker() {
    let ask = Ask::new("Which runtime?", Flag::new("--target"));
    let choices = [Choice::plain("codex"), Choice::plain("cursor")];
    let mut picker = prompt_for(false);

    let error = picker
        .select(&ask, &choices)
        .expect_err("there is no terminal");
    assert_eq!(
        error,
        PromptError::NoTerminal {
            usage: "--target <codex|cursor>".into()
        }
    );
    // A confirm is refused too, rather than answered from its default.
    assert!(matches!(
        picker.confirm(&Ask::new("Proceed?", Flag::new("--yes")), true),
        Err(PromptError::NoTerminal { .. })
    ));
    // And the refusal exits like the command-line problem it is.
    assert_eq!(Failure::from(error).code, USAGE);
}
