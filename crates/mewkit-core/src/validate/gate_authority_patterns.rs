//! The fixed pattern set the gate-authority scan matches, and the two patterns
//! that scope it: the negation that disarms a claim, and the clause split that
//! keeps one clause's negation out of another's.
//!
//! Split from the scan so the TABLE reads as a table. Every source string here
//! is the `RegExp.source` of its TypeScript counterpart verbatim, compiled
//! through [`crate::js_regex`] so `\b`, `\w` and `\s` keep their ECMAScript
//! meanings — a Unicode `\b` would stop matching next to a non-ASCII letter.
use std::sync::LazyLock;

use regex::Regex;

/// Suppression marker for prose that legitimately QUOTES the anti-pattern.
pub(super) const ALLOW_MARKER: &str = "lint-allow-gate-authority";

/// How far back from a match to look for the word that negates it. A negation
/// governs the clause it introduces, so it sits immediately before the claim.
pub(super) const NEGATION_LOOKBEHIND: usize = 48;

pub(super) struct Pattern {
    pub(super) source: &'static str,
    pub(super) expected: &'static str,
}

/// Statements that grant automated gate approval, each scoped to an explicit
/// `Gate 1` / `Gate 2` reference or an unambiguous euphemism — so a skill's own
/// "HARD GATE" or a domain gate metaphor cannot trip the check.
pub(super) const PATTERNS: [Pattern; 8] = [
    Pattern {
        // The digit is REQUIRED, and the gap is deliberately TIGHT: in every
        // real instance the verb and its gate are adjacent, while a wide gap
        // lets one match span two clauses, where a negated first clause
        // swallows the gate reference belonging to an asserting second one.
        source: r"auto[-\s]?approv\w*[^.\n]{0,20}\bgates?\s*[12]\b",
        expected: "automation executes between gates; a human approves the gate",
    },
    Pattern {
        source: r"\bgate\s*[12]\b[^.\n]{0,30}auto[-\s]?approv\w*",
        expected: "automation executes between gates; a human approves the gate",
    },
    Pattern {
        source: r"\bgate\s*[12]\s*:\s*auto",
        expected: "Gate 1 / Gate 2 are human in every mode",
    },
    Pattern {
        source: r"\bgate\s*[12]\b[^.\n]{0,30}\[[^\]\n]*auto[^\]\n]*\]",
        expected: "the only gate outcome is human approval — drop the auto alternative",
    },
    Pattern {
        source: r"\bstamp\s+counts\b",
        expected: "an evaluator stamp is evidence presented at the gate, never the approval",
    },
    Pattern {
        source: r"\bskips?\s+gate\s*[12]\b[^.\n]{0,30}(prompt|user)",
        expected: "present the gate; a passing pre-check is evidence, not approval",
    },
    Pattern {
        // The `--advice` supervision lane adds vocabulary that reads like
        // authority. Requires an ASSERTIVE verb plus an explicit gate digit, so
        // merely NAMING the anti-pattern stays clean — the contract has to be
        // able to describe the thing it forbids.
        source: r"(?:READY_FOR_EXISTING_GATE|RETURN_TO_EXECUTOR|supervision|counsel|directive)[^.\n]{0,40}\b(?:approves?|clears?|advances?|unblocks?)\s+(?:the\s+)?gates?\s*[12]\b",
        expected: "a supervision disposition routes work; a human approves the gate",
    },
    Pattern {
        // "counts as verification" needs NO subject: after clause splitting the
        // subject is often a pronoun. The "is verification" form keeps one,
        // since that wording appears in legitimate prose far more often.
        source: r"\bcounts\s+as\s+verification\b|\b(?:supervision|counsel|directive|advice|athena)\b[^.\n]{0,25}\bis\s+verification\b",
        expected: "verification comes from tests and verdicts; a directive is evidence, not proof",
    },
];

pub(super) static COMPILED: LazyLock<Vec<Regex>> = LazyLock::new(|| {
    PATTERNS
        .iter()
        .map(|p| crate::js_regex::compile_ci(p.source).expect("a static gate-authority pattern"))
        .collect()
});

/// Words that flip a claim from ASSERTING automated approval to FORBIDDING it.
pub(super) static NEGATION: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile_ci(
        r"\b(never|not|n't|no|none|cannot|can't|forbidden|prohibited|non-negotiable|mandatory|requires?\s+human|human\s+approval|explicitly\s+typed)\b",
    )
    .expect("a static negation pattern")
});

pub(super) static CLAUSE_SPLIT: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile_ci(
        r"\.\s|[.;]|,\s*(?:but|yet|however|though|although|whereas|while)\b",
    )
    .expect("a static clause-split pattern")
});

pub(super) static STANDALONE_MARKER: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile(r"^\s*<!--\s*lint-allow-gate-authority\s*-->\s*$")
        .expect("a static marker pattern")
});
