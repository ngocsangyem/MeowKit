//! One value of the config subset: the constructs that are not a scalar at all,
//! and the spellings of a scalar the subset refuses.
//!
//! This is where the two readers of `.meowkit/config.yaml` part company most
//! quietly, so it is the half of the grammar worth reading on its own. A full
//! YAML parser resolves `True`, `+5`, `0x1f`, `.inf` and `"LEA\x4E"`; the hand
//! reader in `.claude/hooks/lib/yaml-subset.cjs` sees five strings. Every one of
//! them is therefore refused by name, with that reader's identifier, before any
//! type is guessed — and the message says what to write instead.
use super::config_values::ConfigValue;
use super::scalar_spelling::{
    is_decimal_int, is_floatish, is_integerish, is_misspelled_boolean, is_nullish,
};
use super::yaml_grammar::{GrammarError, fail};

/// The first out-of-subset spelling in `text`, or `Ok(())` when it is inside it.
/// `path` is the dotted key, which is what the message names.
fn check_scalar_spelling(text: &str, line: usize, path: &str) -> Result<(), GrammarError> {
    let quote = text.chars().next().filter(|ch| *ch == '"' || *ch == '\'');
    if let Some(quote) = quote {
        let body = &text[quote.len_utf8()..];
        let Some(close) = body.find(quote) else {
            return fail(
                "unterminated-quote",
                line,
                format!("{path} opens a quote and never closes it; add the closing {quote}"),
            );
        };
        if close != body.len() - quote.len_utf8() {
            return fail(
                "trailing-content-after-quote",
                line,
                format!(
                    "{path} has content after the closing quote; a value is one scalar, and the grammar has no '' escape"
                ),
            );
        }
        if quote == '"' && body.contains('\\') {
            return fail(
                "escape-not-supported",
                line,
                format!(
                    "{path} uses a backslash escape; the grammar takes characters literally, so write the character itself or drop the quotes"
                ),
            );
        }
        return Ok(());
    }
    // Null and float are where the two readers would otherwise part company: a
    // full parser gives `null` and `1.5`, the hand reader sees the words.
    // Neither type is in the subset, so both refuse rather than guess.
    if is_nullish(text) {
        return fail(
            "null-not-supported",
            line,
            format!("{path} has no value; remove the key instead of setting it to null"),
        );
    }
    if is_misspelled_boolean(text) {
        return fail(
            "bad-boolean-spelling",
            line,
            format!(
                "{path} is {text}, which is not a boolean here; write true or false in lower case"
            ),
        );
    }
    if is_floatish(text) {
        return fail(
            "float-not-supported",
            line,
            format!(
                "{path} is {text}; the config grammar has whole numbers and strings, not decimals"
            ),
        );
    }
    if is_integerish(text) && !is_decimal_int(text) {
        return fail(
            "non-decimal-integer",
            line,
            format!(
                "{path} is {text}; write decimal digits with no sign, no underscores and no 0x/0o/0b prefix"
            ),
        );
    }
    Ok(())
}

/// A scalar, or the construct that is not one. Boolean and whole number are
/// recognised; everything else inside the subset is a string.
pub(super) fn scalar(text: &str, line: usize, path: &str) -> Result<ConfigValue, GrammarError> {
    let first = text.chars().next();
    match first {
        Some('&' | '*') => {
            return fail(
                "anchor-not-supported",
                line,
                "YAML anchors and aliases are not part of the config grammar".to_string(),
            );
        }
        Some('!') => {
            return fail(
                "tag-not-supported",
                line,
                "YAML tags are not part of the config grammar; drop the tag and write the plain value"
                    .to_string(),
            );
        }
        Some('|' | '>') => {
            return fail(
                "block-scalar-not-supported",
                line,
                "multi-line scalars are not part of the config grammar".to_string(),
            );
        }
        Some('[' | '{') => {
            return fail(
                "flow-collection-not-supported",
                line,
                "inline lists and maps are not part of the config grammar".to_string(),
            );
        }
        _ => {}
    }
    check_scalar_spelling(text, line, path)?;
    if let Some(quote) = first.filter(|ch| *ch == '"' || *ch == '\'') {
        let inner = &text[quote.len_utf8()..text.len() - quote.len_utf8()];
        return Ok(ConfigValue::Str(inner.to_string()));
    }
    if text == "true" || text == "false" {
        return Ok(ConfigValue::Bool(text == "true"));
    }
    if is_decimal_int(text) {
        // A whole number too large for `i64` is still a whole NUMBER, and both
        // JavaScript readers accept it: `yaml-subset.cjs` uses
        // `Number.parseInt` and js-yaml yields a double, so each of them also
        // loses precision above 2^53 rather than refusing the file. Refusing it
        // here made this reader stricter than the two it must agree with, under
        // an error code the TypeScript can never emit. The value saturates —
        // every reader applies an approximation, and `i64::MAX` is the closest
        // one this type can hold.
        return Ok(ConfigValue::Int(text.parse::<i64>().unwrap_or(i64::MAX)));
    }
    Ok(ConfigValue::Str(text.to_string()))
}
