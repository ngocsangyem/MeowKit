//! The per-skill measures behind the mechanical rubric: the description's
//! shape, the entry file's size, emphasis density and harness tool names
//! without a fallback. Each function reads one skill's text and returns a
//! number or a list; the thresholds that turn them into pass or fail live in
//! `skill_rubric`.
use std::sync::LazyLock;

use regex::Regex;
use serde_json::Value;

use super::generic_tokens_body::body_lines;

/// Token figures are an estimate, characters divided by four — the same
/// estimate the always-on budget script prints.
pub const CHARS_PER_TOKEN: usize = 4;

/// How many lines either side of a tool name a fallback may sit on.
pub const FALLBACK_WINDOW: usize = 3;

/// Words the instruction-criteria checker counts as emphatic, spelled the same.
static EMPHATIC: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile(
        r"\b(?:MUST|NEVER|ALWAYS|IMPORTANT|CRITICAL|NON-NEGOTIABLE|MANDATORY)\b",
    )
    .expect("a static emphatic pattern")
});
static BOLD: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile(r"\*\*([^*\n]+)\*\*").expect("a static bold pattern")
});
static WHEN_NOT: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile_ci(r"\bnot for\b|\bdo not use\b|\bdon't use\b|\bnot when\b")
        .expect("a static when-not pattern")
});
static WHEN: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile_ci(r"\buse (?:it )?when\b|\bwhen\b|\bfor (?:any|every)\b")
        .expect("a static when pattern")
});
/// Tool names only one harness defines, and the call forms of its delegation tools.
static HARNESS_TOOL: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile(
        r"\bAskUserQuestion\b|\bTodoWrite\b|\bTask(?:Create|Update|List|Get)\b|\bSendMessage\b|\bAgent\(|\bTask\(",
    )
    .expect("a static harness-tool pattern")
});
static FALLBACK: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile_ci(
        r"\bfall(?:s)? ?back\b|\bfallback\b|\bunavailable\b|\bnot available\b|\bisn't available\b|\bwithout (?:that|this|the) tool\b|\bon (?:other|another|a different) (?:runtime|host|harness)|\bother runtimes\b|\bif (?:your|the) (?:runtime|host|harness)\b",
    )
    .expect("a static fallback pattern")
});

/// What the description and `when_to_use` say, and how long they are.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct DescriptionMeasure {
    pub description_chars: usize,
    /// Description plus `when_to_use`: what Claude Code lists together.
    pub listing_chars: usize,
    pub states_what: bool,
    pub states_when: bool,
    pub states_when_not: bool,
}

fn string_field<'a>(meta: &'a Value, key: &str) -> &'a str {
    meta.get(key).and_then(Value::as_str).unwrap_or("").trim()
}

/// Read the description fields from a SKILL.md's frontmatter. A missing or
/// unparsable frontmatter reads as an empty description, which fails every part.
pub fn measure_description(skill_md: &str) -> DescriptionMeasure {
    let meta = crate::yaml_doc::split_frontmatter(skill_md)
        .and_then(|(block, _)| crate::yaml_doc::parse_value(block).ok())
        .unwrap_or(Value::Null);
    let description = string_field(&meta, "description");
    let when_to_use = string_field(&meta, "when_to_use");
    // The "what" is the text before any when-not clause: it must say something
    // on its own, not only name what the skill is not.
    let what = WHEN_NOT
        .find(description)
        .map_or(description, |m| &description[..m.start()]);
    DescriptionMeasure {
        description_chars: description.chars().count(),
        listing_chars: description.chars().count() + when_to_use.chars().count(),
        states_what: what.split_whitespace().count() >= 2,
        states_when: !when_to_use.is_empty() || WHEN.is_match(description),
        states_when_not: WHEN_NOT.is_match(description) || WHEN_NOT.is_match(when_to_use),
    }
}

/// The entry file's size: characters, lines and estimated tokens.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct EntryMeasure {
    pub chars: usize,
    pub lines: usize,
    pub tokens: usize,
}

pub fn measure_entry(skill_md: &str) -> EntryMeasure {
    let chars = skill_md.chars().count();
    EntryMeasure {
        chars,
        lines: skill_md.trim_end_matches('\n').split('\n').count(),
        tokens: chars.div_ceil(CHARS_PER_TOKEN),
    }
}

/// Emphatic words and all-caps bold spans in the entry file's body.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct EmphasisMeasure {
    pub marks: usize,
    pub words: usize,
}

impl EmphasisMeasure {
    pub fn per_1000_words(&self) -> f64 {
        if self.words == 0 {
            0.0
        } else {
            self.marks as f64 * 1000.0 / self.words as f64
        }
    }
}

/// A bold span written in capitals (`**HARD GATE**`). One already holding an
/// emphatic word is not counted twice.
fn is_caps_bold(inner: &str) -> bool {
    let letters: Vec<char> = inner.chars().filter(|c| c.is_alphabetic()).collect();
    letters.len() >= 3 && letters.iter().all(|c| c.is_uppercase()) && !EMPHATIC.is_match(inner)
}

pub fn measure_emphasis(skill_md: &str) -> EmphasisMeasure {
    let body = crate::yaml_doc::split_frontmatter(skill_md).map_or(skill_md, |(_, body)| body);
    let words = body
        .split_whitespace()
        .filter(|w| w.chars().any(char::is_alphanumeric))
        .count();
    let caps_bold = BOLD
        .captures_iter(body)
        .filter(|caps| is_caps_bold(&caps[1]))
        .count();
    EmphasisMeasure {
        marks: EMPHATIC.find_iter(body).count() + caps_bold,
        words,
    }
}

/// Harness tool names in one file's body with no fallback stated within
/// [`FALLBACK_WINDOW`] lines, as `line: token`.
pub fn unhedged_tool_names(text: &str) -> Vec<(usize, String)> {
    let lines = body_lines(text);
    let mut out = Vec::new();
    for (index, line) in lines.iter().enumerate() {
        for found in HARNESS_TOOL.find_iter(&line.text) {
            let from = index.saturating_sub(FALLBACK_WINDOW);
            let to = (index + FALLBACK_WINDOW + 1).min(lines.len());
            let hedged = lines[from..to].iter().any(|l| FALLBACK.is_match(&l.text));
            if !hedged {
                out.push((line.line, found.as_str().trim_end().to_string()));
            }
        }
    }
    out
}
