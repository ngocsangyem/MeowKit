//! JavaScript value semantics the npm CLI's output depends on, for code that
//! prints or groups loosely-typed JSON the way the TypeScript does.
//!
//! - [`js_number_text`] — `String(n)` for a double (`2` not `2.0`).
//! - [`js_string`] — `String(value)` coercion (arrays join, objects print
//!   `[object Object]`), which is what a regex `.test(value)` sees.
//! - [`js_truthy`] — `!!value`.
//! - [`js_object_order`] — the key order `JSON.stringify` and `Object.entries`
//!   use: canonical array-index keys ascending first, then the rest in
//!   insertion order.
//! - [`js_date_parse_millis`] — `Date.parse` for the ISO 8601 forms the kit
//!   writes, with V8's tolerances (a space or `t` before the time, a day past
//!   the month's end rolling over). Other spellings V8 also accepts ("Nov 13
//!   2026") read as `NaN` here, and an offset-less date-time is read as UTC
//!   rather than local time.
use serde_json::{Map, Value};

/// `String(n)`: no grouping, `-0` as `0`, and JavaScript's exponent form at
/// the two magnitudes where it switches over (`1e+21`, `1e-7`). Between them
/// Rust's shortest round-trip form agrees with V8.
pub fn js_number_text(n: f64) -> String {
    if n.is_nan() {
        return "NaN".into();
    }
    if n.is_infinite() {
        return if n > 0.0 { "Infinity" } else { "-Infinity" }.into();
    }
    if n == 0.0 {
        return "0".into();
    }
    let magnitude = n.abs();
    if magnitude >= 1e21 || magnitude < 1e-6 {
        // JavaScript always signs a positive exponent.
        let text = format!("{n:e}");
        return match text.split_once('e') {
            Some((mantissa, exp)) if !exp.starts_with('-') => format!("{mantissa}e+{exp}"),
            _ => text,
        };
    }
    if n.fract() == 0.0 {
        return format!("{}", n as i128);
    }
    format!("{n}")
}

/// A JSON number in JavaScript's spelling (`JSON.stringify` agrees with
/// `String` for every finite double).
pub fn js_json_number(n: f64) -> Value {
    if n.fract() == 0.0 && n.abs() < 9_007_199_254_740_992.0 {
        return Value::from(n as i64);
    }
    serde_json::Number::from_f64(n).map_or(Value::Null, Value::Number)
}

/// `String(value)`.
pub fn js_string(value: &Value) -> String {
    match value {
        Value::Null => "null".into(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => n.as_f64().map_or_else(|| n.to_string(), js_number_text),
        Value::String(s) => s.clone(),
        // `[1, null, "a"].toString()` is "1,,a": null and undefined are empty.
        Value::Array(items) => items
            .iter()
            .map(|item| match item {
                Value::Null => String::new(),
                other => js_string(other),
            })
            .collect::<Vec<_>>()
            .join(","),
        Value::Object(_) => "[object Object]".into(),
    }
}

/// `!!value`.
pub fn js_truthy(value: &Value) -> bool {
    match value {
        Value::Null => false,
        Value::Bool(b) => *b,
        Value::Number(n) => n.as_f64().is_some_and(|f| f != 0.0 && !f.is_nan()),
        Value::String(s) => !s.is_empty(),
        Value::Array(_) | Value::Object(_) => true,
    }
}

/// A canonical array index: `"0"`, `"17"`, never `"01"` or `"-1"`.
fn array_index(key: &str) -> Option<u32> {
    if key == "0" {
        return Some(0);
    }
    if key.starts_with('0') || !key.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    key.parse::<u32>().ok().filter(|n| *n < u32::MAX)
}

/// Reorder `map` the way a JavaScript object enumerates its own keys.
pub fn js_object_order(map: Map<String, Value>) -> Map<String, Value> {
    let (mut indexed, named): (Vec<_>, Vec<_>) =
        map.into_iter().partition(|(k, _)| array_index(k).is_some());
    indexed.sort_by_key(|(k, _)| array_index(k));
    indexed.into_iter().chain(named).collect()
}

/// `Date.parse(text)` in milliseconds, `None` for `NaN`. Accepts `YYYY`,
/// `YYYY-MM`, `YYYY-MM-DD`, optionally `THH:mm[:ss[.sss]]` with `Z` or
/// `±HH:mm`.
pub fn js_date_parse_millis(text: &str) -> Option<i64> {
    let b = text.as_bytes();
    let num = |from: usize, len: usize| -> Option<i64> {
        let part = b.get(from..from + len)?;
        part.iter()
            .all(u8::is_ascii_digit)
            .then(|| std::str::from_utf8(part).ok()?.parse().ok())?
    };
    let year = num(0, 4)?;
    let (mut month, mut day, mut at) = (1, 1, 4);
    if b.get(at) == Some(&b'-') {
        month = num(at + 1, 2)?;
        at += 3;
        if b.get(at) == Some(&b'-') {
            day = num(at + 1, 2)?;
            at += 3;
        }
    }
    let (mut h, mut m, mut s, mut ms, mut offset) = (0, 0, 0, 0, 0);
    if at < b.len() {
        // V8 also takes a lowercase `t` or a space between date and time.
        if !matches!(b[at], b'T' | b't' | b' ') || at != 10 {
            return None;
        }
        h = num(at + 1, 2)?;
        (b.get(at + 3) == Some(&b':')).then_some(())?;
        m = num(at + 4, 2)?;
        at += 6;
        if b.get(at) == Some(&b':') {
            s = num(at + 1, 2)?;
            at += 3;
            if b.get(at) == Some(&b'.') {
                let digits = b[at + 1..]
                    .iter()
                    .take_while(|c| c.is_ascii_digit())
                    .count();
                (digits > 0).then_some(())?;
                let frac = &text[at + 1..at + 1 + digits.min(3)];
                ms = format!("{frac:0<3}").parse().ok()?;
                at += 1 + digits;
            }
        }
        match b.get(at) {
            Some(b'Z') if at + 1 == b.len() => {}
            Some(sign @ (b'+' | b'-')) if at + 6 == b.len() && b[at + 3] == b':' => {
                let minutes = num(at + 1, 2)? * 60 + num(at + 4, 2)?;
                offset = if *sign == b'+' { minutes } else { -minutes };
            }
            None => {}
            _ => return None,
        }
    }
    // Day 1..=31 in any month: V8 rolls `2026-02-30` over into March rather
    // than refusing it, and the linear day count below does the same.
    let valid = (1..=12).contains(&month)
        && (1..=31).contains(&day)
        && (h < 24 || (h == 24 && m == 0 && s == 0 && ms == 0))
        && m < 60
        && s < 60;
    if !valid {
        return None;
    }
    let days = days_from_civil(year, month, day);
    Some((((days * 24 + h) * 60 + m - offset) * 60 + s) * 1000 + ms)
}

/// Days since 1970-01-01 for a proleptic Gregorian date (Hinnant's algorithm).
fn days_from_civil(year: i64, month: i64, day: i64) -> i64 {
    let y = if month <= 2 { year - 1 } else { year };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let mp = (month + 9) % 12;
    let doy = (153 * mp + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

#[cfg(test)]
#[path = "js_value_tests.rs"]
mod tests;
