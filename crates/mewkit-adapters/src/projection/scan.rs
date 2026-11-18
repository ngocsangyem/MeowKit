//! Literal-needle scanning with context checks, the one primitive every
//! projection rule is built on.

/// What to write in place of one occurrence of a needle.
pub struct Hit {
    pub text: String,
    /// Bytes after the needle that the replacement also covers.
    pub eat_after: usize,
    /// Bytes before the needle that the replacement also covers.
    pub eat_before: usize,
}

impl Hit {
    pub fn new(text: impl Into<String>) -> Self {
        Self {
            text: text.into(),
            eat_after: 0,
            eat_before: 0,
        }
    }

    pub fn after(mut self, bytes: usize) -> Self {
        self.eat_after = bytes;
        self
    }

    pub fn before(mut self, bytes: usize) -> Self {
        self.eat_before = bytes;
        self
    }
}

/// Replace, left to right, each `needle` for which `decide` returns a [`Hit`].
/// `decide` sees the source text before and after the occurrence, never text
/// an earlier replacement wrote.
pub fn replace_each(
    text: &str,
    needle: &str,
    mut decide: impl FnMut(&str, &str) -> Option<Hit>,
) -> String {
    let mut out = String::with_capacity(text.len());
    let mut copied = 0; // source bytes already written or replaced
    let mut from = 0;
    while let Some(i) = text[from..].find(needle) {
        let at = from + i;
        let end = at + needle.len();
        match decide(&text[..at], &text[end..]) {
            // A hit may not reach back into text an earlier hit replaced.
            Some(hit) if at - hit.eat_before >= copied => {
                out.push_str(&text[copied..at - hit.eat_before]);
                out.push_str(&hit.text);
                copied = end + hit.eat_after;
                from = copied.max(at + 1);
            }
            _ => from = at + 1,
        }
        if from >= text.len() {
            break;
        }
    }
    out.push_str(&text[copied..]);
    out
}

/// A letter, digit or underscore: what a regex calls a word character.
pub fn is_word(c: char) -> bool {
    c.is_alphanumeric() || c == '_'
}

pub fn last(s: &str) -> Option<char> {
    s.chars().next_back()
}

pub fn first(s: &str) -> Option<char> {
    s.chars().next()
}

/// The longest prefix of `s` whose characters all satisfy `keep`.
pub fn run(s: &str, keep: impl Fn(char) -> bool) -> &str {
    let end = s.find(|c: char| !keep(c)).unwrap_or(s.len());
    &s[..end]
}

pub fn is_slug(c: char) -> bool {
    c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-'
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn replaces_only_where_decide_says_so_and_does_not_rescan_its_output() {
        let got = replace_each("a.a.xa", "a", |before, _| {
            (last(before) != Some('x')).then(|| Hit::new("aa"))
        });
        assert_eq!(got, "aa.aa.xa");
    }

    #[test]
    fn a_hit_can_cover_text_on_both_sides() {
        let got = replace_each("see `K` and K.", "K", |before, after| {
            let b = usize::from(before.ends_with('`'));
            let a = usize::from(after.starts_with('`'));
            Some(Hit::new("key").before(b).after(a))
        });
        assert_eq!(got, "see key and key.");
    }
}
