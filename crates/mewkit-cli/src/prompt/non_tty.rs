//! The implementation used when there is no terminal.
//!
//! It answers every question the same way: a refusal that names the flag which
//! supplies the answer. That is the whole behaviour, and it is deliberately not
//! "pick the default": a default chosen on the user's behalf in CI installs
//! something nobody asked for, and the failure surfaces later as a wrong
//! install rather than here as a missing flag.

use super::{Ask, Choice, Prompt, PromptError, PromptResult, choice_syntax};

/// Refuses every question, naming the flag that answers it.
#[derive(Debug, Default, Clone, Copy)]
pub struct NonTty;

impl NonTty {
    pub const fn new() -> Self {
        Self
    }

    fn refuse<T>(ask: &Ask<'_>, derived: Option<String>) -> PromptResult<T> {
        Err(PromptError::NoTerminal {
            usage: ask.flag.usage(derived),
        })
    }
}

impl Prompt for NonTty {
    fn select(&mut self, ask: &Ask<'_>, choices: &[Choice]) -> PromptResult<String> {
        Self::refuse(ask, choice_syntax(choices))
    }

    fn multi_select(&mut self, ask: &Ask<'_>, choices: &[Choice]) -> PromptResult<Vec<String>> {
        // Same syntax as `select`; the flag's own help says whether it repeats
        // or takes a comma list, and this message must not guess.
        Self::refuse(ask, choice_syntax(choices))
    }

    fn confirm(&mut self, ask: &Ask<'_>, _default: bool) -> PromptResult<bool> {
        // The default is IGNORED on purpose: answering a confirm from its
        // default is how an unattended run agrees to something it was never
        // asked about.
        Self::refuse(ask, None)
    }

    fn text(&mut self, ask: &Ask<'_>, _default: Option<&str>) -> PromptResult<String> {
        Self::refuse(ask, Some("value".to_string()))
    }
}

#[cfg(test)]
#[path = "non_tty_tests.rs"]
mod tests;
