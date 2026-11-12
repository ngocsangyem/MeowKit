//! The implementation that draws on a real terminal, via `inquire`.
//!
//! `inquire` reports a missing terminal as [`InquireError::NotTTY`], which is
//! mapped back to the SAME flag-naming refusal [`super::NonTty`] returns. So a
//! command that reaches a picker in a non-interactive environment gets one
//! message whichever implementation it happens to hold, and never a raw-mode
//! error from the terminal layer.
//!
//! Esc and Ctrl+C map to [`PromptError::Cancelled`]: a cancelled picker stops
//! the command, it never falls through to a default.

use inquire::error::InquireError;
use inquire::{Confirm, MultiSelect, Select, Text};

use super::{Ask, Choice, Prompt, PromptError, PromptResult, choice_syntax};

/// Asks on the terminal.
#[derive(Debug, Default, Clone, Copy)]
pub struct Tty;

impl Tty {
    pub const fn new() -> Self {
        Self
    }
}

/// Translate a terminal-layer error into this module's vocabulary.
fn translate(error: InquireError, ask: &Ask<'_>, derived: Option<String>) -> PromptError {
    match error {
        InquireError::NotTTY => PromptError::NoTerminal {
            usage: ask.flag.usage(derived),
        },
        InquireError::OperationCanceled | InquireError::OperationInterrupted => {
            PromptError::Cancelled {
                message: ask.message.to_string(),
            }
        }
        other => PromptError::Io(other.to_string()),
    }
}

/// What the picker lists, in the same order as `choices` so an index maps back.
fn labels(choices: &[Choice]) -> Vec<String> {
    choices.iter().map(Choice::display).collect()
}

/// A question with no options cannot be asked. Reported as the same refusal, so
/// a caller that filtered its list down to nothing gets the flag to pass rather
/// than an empty picker.
fn require_choices<T>(ask: &Ask<'_>, choices: &[Choice]) -> Option<PromptResult<T>> {
    choices.is_empty().then(|| {
        Err(PromptError::NoTerminal {
            usage: ask.flag.usage(None),
        })
    })
}

impl Prompt for Tty {
    fn select(&mut self, ask: &Ask<'_>, choices: &[Choice]) -> PromptResult<String> {
        if let Some(refusal) = require_choices(ask, choices) {
            return refusal;
        }
        // `raw_prompt` returns the chosen INDEX, so two choices may share a
        // label without the answer becoming ambiguous.
        Select::new(ask.message, labels(choices))
            .raw_prompt()
            .map(|chosen| choices[chosen.index].value.clone())
            .map_err(|e| translate(e, ask, choice_syntax(choices)))
    }

    fn multi_select(&mut self, ask: &Ask<'_>, choices: &[Choice]) -> PromptResult<Vec<String>> {
        if let Some(refusal) = require_choices(ask, choices) {
            return refusal;
        }
        MultiSelect::new(ask.message, labels(choices))
            .raw_prompt()
            .map(|chosen| {
                let mut indexes: Vec<usize> = chosen.iter().map(|c| c.index).collect();
                // Answer order follows `choices`, not the order the person
                // happened to tick them: a caller comparing it to a flag value
                // must not see a different list for the same selection.
                indexes.sort_unstable();
                indexes
                    .into_iter()
                    .map(|i| choices[i].value.clone())
                    .collect()
            })
            .map_err(|e| translate(e, ask, choice_syntax(choices)))
    }

    fn confirm(&mut self, ask: &Ask<'_>, default: bool) -> PromptResult<bool> {
        Confirm::new(ask.message)
            .with_default(default)
            .prompt()
            .map_err(|e| translate(e, ask, None))
    }

    fn text(&mut self, ask: &Ask<'_>, default: Option<&str>) -> PromptResult<String> {
        let prompt = Text::new(ask.message);
        let prompt = match default {
            Some(value) => prompt.with_default(value),
            None => prompt,
        };
        prompt
            .prompt()
            .map_err(|e| translate(e, ask, Some("value".to_string())))
    }
}

#[cfg(test)]
#[path = "tty_tests.rs"]
mod tests;
