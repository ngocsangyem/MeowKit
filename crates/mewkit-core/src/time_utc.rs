//! UTC calendar formatting for the two stamps the durable logs carry.
//!
//! The TypeScript writers build these with `Date#toISOString`, so a ported
//! writer has to produce the SAME characters from a unix instant — a log line
//! is compared field for field against the one the npm CLI writes. A date
//! library is not worth a dependency (and `cargo deny` reviews every one) for
//! two formats over a proleptic Gregorian calendar, so the civil-date
//! conversion is inline below.

/// Civil date from a day count relative to 1970-01-01 (Hinnant's
/// `civil_from_days`): shift the era so the leap rule has no special case at
/// the year boundary, then undo the shift.
fn civil_from_days(days: i64) -> (i64, u32, u32) {
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097); // [0, 146096]
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365; // [0, 399]
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // [0, 365]
    let mp = (5 * doy + 2) / 153; // [0, 11] with March = 0
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32; // [1, 31]
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32; // [1, 12]
    (if m <= 2 { y + 1 } else { y }, m, d)
}

/// Year, month, day, hour, minute, second in UTC for a unix-second instant.
pub fn utc_parts(unix_seconds: i64) -> (i64, u32, u32, u32, u32, u32) {
    let days = unix_seconds.div_euclid(86_400);
    let secs_of_day = unix_seconds.rem_euclid(86_400);
    let (y, mo, d) = civil_from_days(days);
    (
        y,
        mo,
        d,
        (secs_of_day / 3600) as u32,
        ((secs_of_day % 3600) / 60) as u32,
        (secs_of_day % 60) as u32,
    )
}

/// `YYYY-MM-DDTHH:MM:SSZ` — `toISOString()` with the milliseconds dropped, the
/// shape every trace record's `ts` field carries.
pub fn iso_seconds(unix_millis: i64) -> String {
    let (y, mo, d, h, mi, s) = utc_parts(unix_millis.div_euclid(1000));
    format!("{y:04}-{mo:02}-{d:02}T{h:02}:{mi:02}:{s:02}Z")
}

/// `YYYY-MM-DD` — `toISOString().slice(0, 10)`, the calendar DAY a receipt
/// records. UTC like every other stamp here: a local date would make one
/// approval read as a different day depending on who ran it.
pub fn utc_date(unix_millis: i64) -> String {
    let (y, mo, d, ..) = utc_parts(unix_millis.div_euclid(1000));
    format!("{y:04}-{mo:02}-{d:02}")
}

/// `YYMMDD-HHMMSS` — the stamp a rotated log file is named with.
pub fn rotation_stamp(unix_millis: i64) -> String {
    let (y, mo, d, h, mi, s) = utc_parts(unix_millis.div_euclid(1000));
    format!("{:02}{mo:02}{d:02}-{h:02}{mi:02}{s:02}", y.rem_euclid(100))
}

/// Milliseconds since the unix epoch, from the system clock.
pub fn now_millis() -> i64 {
    match std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH) {
        Ok(d) => d.as_millis() as i64,
        // A clock behind the epoch is not worth a failure path in a log writer.
        Err(e) => -(e.duration().as_millis() as i64),
    }
}

#[cfg(test)]
#[path = "time_utc_tests.rs"]
mod tests;
