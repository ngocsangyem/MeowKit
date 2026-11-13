use super::*;

/// Values read out of Node (`new Date(ms).toISOString()`), so the port is pinned
/// against the engine whose output the log lines are compared to.
#[test]
fn iso_seconds_matches_the_javascript_stamps() {
    for (millis, expected) in [
        (0_i64, "1970-01-01T00:00:00Z"),
        (1_762_900_000_000, "2025-11-11T22:26:40Z"),
        (1_794_528_000_123, "2026-11-13T00:00:00Z"),
        // 2024-02-29: the leap day the era shift exists to get right.
        (1_709_164_799_000, "2024-02-28T23:59:59Z"),
        (1_709_164_800_000, "2024-02-29T00:00:00Z"),
        (4_102_444_800_000, "2100-01-01T00:00:00Z"),
    ] {
        assert_eq!(iso_seconds(millis), expected, "millis {millis}");
    }
}

#[test]
fn milliseconds_are_dropped_rather_than_rounded() {
    assert_eq!(iso_seconds(1_762_900_000_999), "2025-11-11T22:26:40Z");
}

#[test]
fn rotation_stamp_is_two_digit_year_then_time() {
    assert_eq!(rotation_stamp(1_762_900_000_000), "251111-222640");
}

#[test]
fn now_is_after_the_release_of_this_code() {
    assert!(now_millis() > 1_700_000_000_000);
}

#[test]
fn utc_date_is_the_calendar_day_of_the_instant() {
    // The last millisecond of a UTC day and the first of the next one.
    assert_eq!(utc_date(1_763_078_399_999), "2025-11-13");
    assert_eq!(utc_date(1_763_078_400_000), "2025-11-14");
    assert_eq!(utc_date(0), "1970-01-01");
}
