//! The three number spellings the budget output uses, as JavaScript writes them.
//!
//! The npm CLI prints token counts with `toLocaleString()`, a monthly total with
//! `String(n)` and a USD amount with `toFixed(2)`. Each has its own rounding and
//! its own grouping, and a port that reached for `format!("{:.2}")` would differ
//! on exactly the values a reader notices: a tie rounds the other way (Rust
//! formats half-to-even, `toFixed` takes the larger magnitude), and a grouped
//! thousand separator has to be inserted by hand.
//!
//! Locale: the default `toLocaleString()` resolves to the host locale, and every
//! environment this kit runs its parity in resolves to the `en-US` pattern —
//! `,` groups, `.` separates the fraction, at most three fraction digits.

/// `Number.prototype.toLocaleString()` with default options.
pub fn to_locale_string(value: f64) -> String {
    if value.is_nan() {
        return "NaN".to_string();
    }
    if value.is_infinite() {
        return if value > 0.0 { "∞" } else { "-∞" }.to_string();
    }
    // `maximumFractionDigits` defaults to 3, and Intl rounds a tie away from
    // zero. Integral values skip the scaling so a large count keeps every digit.
    let rounded = if value.fract() == 0.0 {
        value
    } else {
        (value.abs() * 1000.0).round() / 1000.0 * value.signum()
    };
    let text = format!("{rounded:.3}");
    let (sign, digits) = match text.strip_prefix('-') {
        Some(rest) => ("-", rest),
        None => ("", text.as_str()),
    };
    let (whole, fraction) = digits.split_once('.').unwrap_or((digits, ""));
    let fraction = fraction.trim_end_matches('0');
    let grouped = group_thousands(whole);
    if fraction.is_empty() {
        format!("{sign}{grouped}")
    } else {
        format!("{sign}{grouped}.{fraction}")
    }
}

/// `1234567` → `1,234,567`.
fn group_thousands(whole: &str) -> String {
    let mut out = String::with_capacity(whole.len() + whole.len() / 3);
    for (index, digit) in whole.chars().enumerate() {
        if index > 0 && (whole.len() - index).is_multiple_of(3) {
            out.push(',');
        }
        out.push(digit);
    }
    out
}

/// `Number.prototype.toFixed(digits)`: fixed-point, ties away from zero.
///
/// The rounding is decided on the DECIMAL expansion of the double rather than on
/// the double itself, which is what makes `(0.125).toFixed(2)` `"0.13"` while a
/// half-to-even formatter says `"0.12"`.
pub fn to_fixed(value: f64, digits: usize) -> String {
    if value.is_nan() {
        return "NaN".to_string();
    }
    if value.is_infinite() {
        return if value > 0.0 { "Infinity" } else { "-Infinity" }.to_string();
    }
    let negative = value < 0.0;
    // Wide enough to see a genuine tie (a dyadic fraction terminates well inside
    // this) without printing the whole exact expansion of a denormal.
    let exact = format!("{:.*}", digits + 30, value.abs());
    let (whole, fraction) = exact.split_once('.').unwrap_or((exact.as_str(), ""));
    let mut kept: Vec<u8> = format!("{whole}{}", &fraction[..digits]).into_bytes();
    let round_up = fraction.as_bytes().get(digits).is_some_and(|d| *d >= b'5');
    if round_up {
        carry(&mut kept);
    }
    let text = String::from_utf8(kept).unwrap_or_default();
    let split = text.len() - digits;
    let (whole, fraction) = text.split_at(split);
    let whole = whole.trim_start_matches('0');
    let whole = if whole.is_empty() { "0" } else { whole };
    // A negative that rounds to zero still prints its sign (`-0.00`), because
    // `toFixed` fixes the sign before it rounds the magnitude.
    let sign = if negative { "-" } else { "" };
    if digits == 0 {
        format!("{sign}{whole}")
    } else {
        format!("{sign}{whole}.{fraction}")
    }
}

/// Add one to a big-endian decimal digit string, growing it on overflow.
fn carry(digits: &mut Vec<u8>) {
    for index in (0..digits.len()).rev() {
        if digits[index] == b'9' {
            digits[index] = b'0';
            continue;
        }
        digits[index] += 1;
        return;
    }
    digits.insert(0, b'1');
}
