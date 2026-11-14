//! What a question is made of: the options, the flag that answers it without a
//! terminal, and the message itself.
//!
//! The flag is part of the QUESTION, not of the error path. A picker written
//! without a flag equivalent therefore cannot be asked at all, so the gap shows
//! up where the question is written rather than where CI hangs.

/// One selectable option: the value a flag would carry, the label a person
/// reads, and an optional one-line hint.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Choice {
    pub value: String,
    pub label: String,
    pub hint: Option<String>,
}

impl Choice {
    /// A choice whose label is its value — the common case for an id a flag
    /// also accepts.
    pub fn plain(value: impl Into<String>) -> Self {
        let value = value.into();
        Self {
            label: value.clone(),
            value,
            hint: None,
        }
    }

    /// A value shown under a display label; the ported pickers show raw values.
    #[cfg_attr(not(test), allow(dead_code))]
    pub fn labelled(value: impl Into<String>, label: impl Into<String>) -> Self {
        Self {
            value: value.into(),
            label: label.into(),
            hint: None,
        }
    }

    pub fn with_hint(mut self, hint: impl Into<String>) -> Self {
        self.hint = Some(hint.into());
        self
    }

    /// What the TTY implementation shows for this choice.
    pub(super) fn display(&self) -> String {
        match &self.hint {
            Some(hint) => format!("{} — {hint}", self.label),
            None => self.label.clone(),
        }
    }
}

/// The flag that answers a question without a terminal.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Flag<'a> {
    /// The long flag, written as the user types it: `--target`.
    pub name: &'a str,
    /// The value syntax shown inside `<…>`. `None` means the flag takes no
    /// value (`--yes`), or — for a choice-backed question — that the syntax is
    /// derived from the choices themselves.
    pub value_syntax: Option<&'a str>,
}

impl<'a> Flag<'a> {
    pub const fn new(name: &'a str) -> Self {
        Self {
            name,
            value_syntax: None,
        }
    }

    pub const fn with_value(name: &'a str, value_syntax: &'a str) -> Self {
        Self {
            name,
            value_syntax: Some(value_syntax),
        }
    }

    /// How the refusal spells this flag out. `derived` is the syntax the
    /// question's own choices imply, used when the flag does not override it.
    pub(super) fn usage(&self, derived: Option<String>) -> String {
        match self.value_syntax.map(str::to_string).or(derived) {
            Some(syntax) => format!("{} <{syntax}>", self.name),
            None => self.name.to_string(),
        }
    }
}

/// A question: what to ask, and which flag answers it without a terminal.
#[derive(Debug, Clone, Copy)]
pub struct Ask<'a> {
    pub message: &'a str,
    pub flag: Flag<'a>,
}

impl<'a> Ask<'a> {
    pub const fn new(message: &'a str, flag: Flag<'a>) -> Self {
        Self { message, flag }
    }
}

/// The flag syntax a set of choices implies: `claude-code|codex|cursor`.
pub fn choice_syntax(choices: &[Choice]) -> Option<String> {
    if choices.is_empty() {
        None
    } else {
        Some(
            choices
                .iter()
                .map(|c| c.value.as_str())
                .collect::<Vec<_>>()
                .join("|"),
        )
    }
}

#[cfg(test)]
#[path = "question_tests.rs"]
mod tests;
