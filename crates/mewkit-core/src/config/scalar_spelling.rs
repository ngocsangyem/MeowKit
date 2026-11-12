//! Which spellings of a scalar are inside the config subset, and which are not.
//!
//! A value's SPELLING is where two readers part company most quietly. A full
//! YAML parser resolves `True`, `+5`, `0x1f`, `.inf` and `"LEA\x4E"`; a hand
//! reader sees five strings, and the same committed file would then mean
//! different things on either side of the kit. Every spelling outside the subset
//! is refused by name, with the identifier the hook reader uses, and the message
//! says what to write instead.
//!
//! The patterns are the regular expressions in `yaml-grammar.ts` and
//! `yaml-subset.cjs`, hand-matched here: the grammar is small enough to read as
//! code, and a regex engine is a dependency this layer does not need.

/// `^-?(0|[1-9]\d*)$` — the one integer spelling the subset has.
pub fn is_decimal_int(text: &str) -> bool {
    let digits = text.strip_prefix('-').unwrap_or(text);
    match digits.as_bytes() {
        [] => false,
        [b'0'] => true,
        [b'0', ..] => false,
        bytes => bytes.iter().all(u8::is_ascii_digit),
    }
}

/// `^(True|TRUE|False|FALSE)$` — a boolean a full parser resolves and the hand
/// reader would keep as text.
pub fn is_misspelled_boolean(text: &str) -> bool {
    matches!(text, "True" | "TRUE" | "False" | "FALSE")
}

/// `^(null|Null|NULL|~)$`.
pub fn is_nullish(text: &str) -> bool {
    matches!(text, "null" | "Null" | "NULL" | "~")
}

/// `^[-+]?(0[xXoObB][0-9A-Fa-f_]+|\d[\d_]*)$` — anything a parser would read as
/// a number, including the spellings the subset refuses.
pub fn is_integerish(text: &str) -> bool {
    let body = text.strip_prefix(['-', '+']).unwrap_or(text);
    let bytes = body.as_bytes();
    if let [b'0', radix, rest @ ..] = bytes
        && matches!(radix, b'x' | b'X' | b'o' | b'O' | b'b' | b'B')
    {
        return !rest.is_empty()
            && rest
                .iter()
                .all(|byte| byte.is_ascii_hexdigit() || *byte == b'_');
    }
    match bytes {
        [first, rest @ ..] if first.is_ascii_digit() => rest
            .iter()
            .all(|byte| byte.is_ascii_digit() || *byte == b'_'),
        _ => false,
    }
}

/// `^[-+]?(\.\d+|\d+\.\d*|\d+(\.\d*)?[eE][-+]?\d+|\.(inf|Inf|INF|nan|NaN|NAN))$`
pub fn is_floatish(text: &str) -> bool {
    let body = text.strip_prefix(['-', '+']).unwrap_or(text);
    if let Some(rest) = body.strip_prefix('.') {
        if matches!(rest, "inf" | "Inf" | "INF" | "nan" | "NaN" | "NAN") {
            return true;
        }
        // `.\d+`
        return !rest.is_empty() && rest.bytes().all(|byte| byte.is_ascii_digit());
    }
    let (mantissa, exponent) = match body.split_once(['e', 'E']) {
        Some((mantissa, exponent)) => (mantissa, Some(exponent)),
        None => (body, None),
    };
    let (whole, fraction) = match mantissa.split_once('.') {
        Some((whole, fraction)) => (whole, Some(fraction)),
        None => (mantissa, None),
    };
    let digits = |text: &str| !text.is_empty() && text.bytes().all(|byte| byte.is_ascii_digit());
    if !digits(whole) {
        return false;
    }
    if fraction.is_some_and(|text| !text.is_empty() && !digits(text)) {
        return false;
    }
    match exponent {
        // `\d+(\.\d*)?[eE][-+]?\d+`
        Some(exponent) => digits(exponent.strip_prefix(['-', '+']).unwrap_or(exponent)),
        // `\d+\.\d*` — a bare integer is not a float, a trailing dot is.
        None => fraction.is_some(),
    }
}

/// `^[A-Za-z][A-Za-z0-9_.-]*$` — the shape of a config key, dots included
/// because the dotted-key refusal needs to name the path it saw.
pub fn is_key_shaped(text: &str) -> bool {
    let mut chars = text.chars();
    match chars.next() {
        Some(first) if first.is_ascii_alphabetic() => {}
        _ => return false,
    }
    chars.all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '.' || ch == '-')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decimal_integers_are_the_plain_ones_only() {
        // `^-?(0|[1-9]\d*)$`: a leading zero is out, a leading minus is in —
        // including `-0`, which the JS pattern admits too.
        for text in ["0", "5", "-1", "100", "-100", "-0"] {
            assert!(is_decimal_int(text), "{text}");
        }
        for text in ["+5", "05", "0x1f", "1_000", "", "-", "1.5"] {
            assert!(!is_decimal_int(text), "{text}");
        }
    }

    #[test]
    fn integerish_catches_every_radix_a_parser_would_resolve() {
        for text in ["0x1f", "0o17", "0b101", "+5", "1_000", "0X1F", "7"] {
            assert!(is_integerish(text), "{text}");
        }
        for text in ["0x", "1.5", "abc", "", "+", ".5"] {
            assert!(!is_integerish(text), "{text}");
        }
    }

    #[test]
    fn floatish_catches_decimals_exponents_and_the_infinities() {
        for text in [
            "1.5", "-1.5", ".5", "1.", "1e9", "1.0E-3", ".inf", "-.inf", ".NaN",
        ] {
            assert!(is_floatish(text), "{text}");
        }
        for text in ["5", "-5", "0x1f", "abc", "", ".", "1e", "e9"] {
            assert!(!is_floatish(text), "{text}");
        }
    }

    #[test]
    fn a_key_starts_with_a_letter() {
        assert!(is_key_shaped("budget"));
        assert!(is_key_shaped("budget.cap"));
        assert!(is_key_shaped("pre-ship"));
        assert!(!is_key_shaped("$schema"));
        assert!(!is_key_shaped("1key"));
        assert!(!is_key_shaped(""));
        assert!(!is_key_shaped("key with space"));
    }
}
