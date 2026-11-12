// Every expectation here is the VERIFIED JavaScript answer, produced by running
// the same source and input through Node:
//
//   node -e 'console.log(/\bjailbreak\b/i.test("\u00e9jailbreak"))'   // true
//
// The rows that distinguish the two engines are called out individually.
use super::*;

#[test]
fn a_word_boundary_becomes_ascii_only() {
    let re = compile_ci(r"\bjailbreak\b").expect("compiles");
    // JS: both match, because `é`/`й` are not ASCII word characters and so ARE
    // a boundary. Unicode `\b` says they are not, which is how a one-byte
    // prefix used to defeat the scan.
    assert!(re.is_match("\u{e9}jailbreak"));
    assert!(re.is_match("jailbreak\u{439}"));
    assert!(re.is_match("a jailbreak now"));
    // Still a boundary assertion: an ASCII letter adjacent still blocks it.
    assert!(!re.is_match("xjailbreakx"));
}

#[test]
fn digits_are_ascii_only() {
    let re = compile(r"^\d{6}$").expect("compiles");
    assert!(re.is_match("251112"));
    // Arabic-Indic digits: `\p{Nd}` matches them, ECMAScript `\d` does not.
    assert!(!re.is_match("\u{661}\u{662}\u{663}\u{664}\u{665}\u{666}"));
}

#[test]
fn word_characters_are_ascii_only() {
    let re = compile_ci(r"call\s+the\s+\w+\s+tool").expect("compiles");
    assert!(re.is_match("call the bash tool"));
    // JS does not match a Cyrillic tool name; neither do we now.
    assert!(!re.is_match("call the \u{432}\u{43e}\u{442} tool"));
}

#[test]
fn whitespace_is_the_ecmascript_set_not_the_unicode_one() {
    let re = compile_ci(r"ignore\s+(?:previous|all)\s+instructions").expect("compiles");
    assert!(re.is_match("ignore previous instructions"));
    // NBSP and ZWNBSP: BOTH are ECMAScript whitespace. `\p{White_Space}` omits
    // U+FEFF, which is why `(?-u:\s)` would have been wrong too.
    assert!(re.is_match("ignore\u{a0}previous\u{a0}instructions"));
    assert!(re.is_match("ignore\u{feff}previous\u{feff}instructions"));
    assert!(re.is_match("ignore\u{2028}previous\u{2029}instructions"));
    // U+0085 (NEL) is `\p{White_Space}` but NOT ECMAScript whitespace.
    assert!(!re.is_match("ignore\u{85}previous\u{85}instructions"));
}

#[test]
fn a_shorthand_inside_a_class_expands_in_place() {
    assert_eq!(translate(r"(^|[^\d])").expect("translates"), "(^|[^0-9])");
    let re = compile(r"[^\s\x22']+").expect("compiles");
    // JS stops the run at U+FEFF because it is whitespace there.
    let hit = re.find("ab\u{feff}cd").expect("a match");
    assert_eq!(hit.as_str(), "ab");
}

#[test]
fn an_unexpandable_class_shorthand_is_refused_rather_than_approximated() {
    let err = translate(r"[\S]").expect_err("no equivalent");
    assert!(err.contains("character class"), "{err}");
    assert!(translate(r"\x5c").is_ok());
}

#[test]
fn an_escaped_backslash_is_not_mistaken_for_a_shorthand() {
    // `\\d` is a literal backslash followed by `d`, not a digit class.
    assert_eq!(translate(r"\\d").expect("translates"), r"\\d");
    assert!(compile(r"\\d").expect("compiles").is_match(r"\d"));
}

#[test]
fn a_bracket_inside_a_class_stays_literal() {
    assert_eq!(translate(r"[a[\d]").expect("translates"), "[a[0-9]");
}

#[test]
fn a_backspace_class_is_not_a_boundary() {
    assert_eq!(translate(r"[\b]").expect("translates"), r"[\x08]");
}

#[test]
fn folding_line_terminators_restores_javascript_multiline_anchoring() {
    let re = compile(r"(?m)^(?:diff --git |@@ -\d|\+\+\+ b\/)").expect("compiles");
    // Rust anchors `(?m)^` after `\n` only; JS also anchors after a lone `\r`,
    // U+2028 and U+2029. A diff header hidden behind one of those used to pass.
    for terminator in ['\r', '\u{2028}', '\u{2029}', '\n'] {
        let text = format!("note{terminator}diff --git a/x b/x");
        assert!(
            re.is_match(&fold_line_terminators(&text)),
            "terminator {:?} did not anchor",
            terminator
        );
    }
    assert!(!re.is_match(&fold_line_terminators("note diff --git a/x")));
}

#[test]
fn folding_borrows_when_there_is_nothing_to_fold() {
    assert!(matches!(
        fold_line_terminators("plain\ntext"),
        std::borrow::Cow::Borrowed(_)
    ));
}

#[test]
fn a_dot_stops_at_every_javascript_line_terminator_once_folded() {
    let re = compile(r"(?m)^\s*at\s+\S+\s+\(.*:\d+:\d+\)\s*$").expect("compiles");
    // `.` in Rust matches `\r`, U+2028 and U+2029; in JS it matches none of
    // them. Folding makes the two agree without touching the pattern.
    let text = "at fn (file.ts:1:2)\rtrailing";
    assert!(re.is_match(&fold_line_terminators(text)));
}

#[test]
fn the_whitespace_predicate_and_the_whitespace_class_are_the_same_set() {
    // Two spellings of one definition drift. This is the guard: the predicate
    // `word_count` splits on must accept exactly what the translated `\s`
    // matches, over every code point either engine could plausibly see.
    let class = compile(r"^\s$").expect("compiles");
    for code in (0..0x3100u32).chain(0xfe00..0xff00) {
        let Some(ch) = char::from_u32(code) else {
            continue;
        };
        let mut buffer = [0u8; 4];
        assert_eq!(
            class.is_match(ch.encode_utf8(&mut buffer)),
            is_js_whitespace(ch),
            "U+{code:04X} disagrees between the class and the predicate"
        );
    }
}
