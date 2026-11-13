//! Interactive pickers, behind one trait with two implementations.
//!
//! Every picker in the npm CLI's `init`, `pack` and `setup` has a flag
//! equivalent, because a picker is not available in CI, in a hook, or in a
//! piped shell. The trait makes that contract structural: a command asks a
//! question through [`Prompt`], and the non-TTY implementation answers with an
//! error that NAMES the flag which supplies the answer instead of hanging on a
//! terminal that will never respond, defaulting silently, or asking a question
//! nobody can see.
//!
//! Commands ask through [`default_prompt`], the one place the two
//! implementations are chosen between.

use std::fmt;

use crate::failure::{Failure, USAGE};

pub mod non_tty;
pub mod question;
pub mod tty;

// The question vocabulary is part of this module's surface; re-exported whole
// so a caller writes `prompt::Flag`, not `prompt::question::Flag`.
pub use question::*;

/// Why a question could not be answered.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PromptError {
    /// There is no terminal to ask on. Carries the flag usage, so the message
    /// tells the caller exactly what to pass instead.
    NoTerminal { usage: String },
    /// The person cancelled (Esc, or Ctrl+C). NOT an error to paper over: a
    /// cancelled picker means the command must stop, never pick a default.
    Cancelled { message: String },
    /// The terminal itself failed.
    Io(String),
}

impl fmt::Display for PromptError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NoTerminal { usage } => write!(f, "no terminal: pass {usage}"),
            Self::Cancelled { message } => write!(f, "cancelled: {message}"),
            Self::Io(detail) => write!(f, "prompt failed: {detail}"),
        }
    }
}

impl std::error::Error for PromptError {}

impl From<PromptError> for Failure {
    fn from(error: PromptError) -> Self {
        match error {
            // A missing flag IS a command-line problem, so it exits like one.
            PromptError::NoTerminal { .. } => Self {
                code: USAGE,
                message: error.to_string(),
            },
            _ => Self::failed(error.to_string()),
        }
    }
}

pub type PromptResult<T> = Result<T, PromptError>;

/// The four pickers `init`, `pack` and `setup` need.
///
/// `password` is deliberately absent: the npm CLI uses it for provider API
/// keys, and a flag equivalent for a secret would put the credential in argv,
/// where the process list and the shell history can read it. That question needs
/// an environment or secret-store route, which is a separate decision from this
/// trait.
pub trait Prompt {
    /// One of `choices`, returned as the chosen choice's `value`.
    fn select(&mut self, ask: &Ask<'_>, choices: &[Choice]) -> PromptResult<String>;

    /// Zero or more of `choices`, in the order they appear in `choices`.
    fn multi_select(&mut self, ask: &Ask<'_>, choices: &[Choice]) -> PromptResult<Vec<String>>;

    fn confirm(&mut self, ask: &Ask<'_>, default: bool) -> PromptResult<bool>;

    /// No ported picker asks for free text yet; both implementations keep it
    /// tested so the first one that does inherits the flag-naming refusal.
    #[cfg_attr(not(test), allow(dead_code))]
    fn text(&mut self, ask: &Ask<'_>, default: Option<&str>) -> PromptResult<String>;
}

/// Whether stdin AND stderr are a terminal.
///
/// Both matter: inquire reads keys from stdin and draws on stderr, so a piped
/// stdin (`mewkit init < /dev/null`) and a redirected stderr are each enough to
/// make a picker unanswerable.
///
/// Deliberately NOT stdout: a command whose stdout is piped (`mewkit orient |
/// jq`, a hook capturing the output) can still hold a perfectly usable
/// terminal, and treating that as non-interactive would refuse a question
/// nobody needed to refuse.
pub fn is_interactive() -> bool {
    use std::io::IsTerminal;
    std::io::stdin().is_terminal() && std::io::stderr().is_terminal()
}

/// The picker this environment can actually answer: a terminal one when there
/// is a terminal, the flag-naming refusal otherwise.
///
/// Every command asks through this, so the non-interactive path is chosen ONCE
/// rather than per call site — a command that probed interactivity itself would
/// eventually probe it differently, and the difference would show up as a hook
/// hanging on a picker it cannot draw.
pub fn default_prompt() -> Box<dyn Prompt> {
    prompt_for(is_interactive())
}

/// [`default_prompt`] with the decision supplied, so the non-terminal branch is
/// testable without a terminal — and without making a test depend on how the
/// suite was launched.
pub fn prompt_for(interactive: bool) -> Box<dyn Prompt> {
    if interactive {
        Box::new(tty::Tty::new())
    } else {
        Box::new(non_tty::NonTty::new())
    }
}

#[cfg(test)]
#[path = "mod_tests.rs"]
mod tests;
