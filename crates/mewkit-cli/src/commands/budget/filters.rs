//! Turning the two selection flags into filters.
//!
//! Both flags are tri-state in the npm CLI — absent, present with no value,
//! present with one — because `--session` and `--day` on their own mean "the
//! current one" and "today". A port that read them as plain strings would turn
//! the bare form into a filter for the empty string and report nothing.
use mewkit_core::time_utc::{now_millis, utc_date};

/// An absent flag is "no filter"; a flag with no value is "the current one".
pub fn normalize_flag_value(value: Option<&str>) -> Option<String> {
    value.map(|value| value.trim().to_string())
}

/// `--day` with no value means today; a value must be a calendar date.
pub fn resolve_day_filter(value: Option<&str>) -> Result<Option<String>, String> {
    let Some(value) = value else {
        return Ok(None);
    };
    if value.is_empty() {
        return Ok(Some(utc_date(now_millis())));
    }
    // The refusal quotes the TRIMMED value, so `--day "  "` is refused as the
    // empty date it resolved to rather than as the whitespace it was written as.
    let day = value.trim();
    if !is_calendar_date(day) {
        return Err(format!("Invalid --day value: {day} (expected YYYY-MM-DD)"));
    }
    Ok(Some(day.to_string()))
}

/// `^\d{4}-\d{2}-\d{2}$` — the shape only, never whether the date exists.
fn is_calendar_date(text: &str) -> bool {
    let bytes = text.as_bytes();
    bytes.len() == 10
        && bytes.iter().enumerate().all(|(index, byte)| match index {
            4 | 7 => *byte == b'-',
            _ => byte.is_ascii_digit(),
        })
}

#[cfg(test)]
mod tests {
    use super::{normalize_flag_value, resolve_day_filter};

    #[test]
    fn a_bare_flag_is_distinct_from_an_absent_one() {
        assert_eq!(normalize_flag_value(None), None);
        assert_eq!(normalize_flag_value(Some("")), Some(String::new()));
        assert_eq!(
            normalize_flag_value(Some("  abc  ")),
            Some("abc".to_string())
        );
    }

    #[test]
    fn a_day_value_must_be_a_calendar_date() {
        assert_eq!(resolve_day_filter(None), Ok(None));
        assert_eq!(
            resolve_day_filter(Some("2026-11-12")),
            Ok(Some("2026-11-12".to_string()))
        );
        assert_eq!(
            resolve_day_filter(Some(" 2026-11-12 ")),
            Ok(Some("2026-11-12".to_string()))
        );
        assert_eq!(
            resolve_day_filter(Some("bogus")),
            Err("Invalid --day value: bogus (expected YYYY-MM-DD)".to_string())
        );
        assert_eq!(
            resolve_day_filter(Some("  ")),
            Err("Invalid --day value:  (expected YYYY-MM-DD)".to_string())
        );
        // A bare flag resolves to a date, whatever today happens to be.
        assert!(matches!(resolve_day_filter(Some("")), Ok(Some(day)) if day.len() == 10));
    }
}
