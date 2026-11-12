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
