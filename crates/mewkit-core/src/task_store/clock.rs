//! The timestamp a durable record carries.
//!
//! `updatedAt` keeps MILLISECONDS, unlike a trace line's `ts`, which drops them
//! ([`crate::time_utc::iso_seconds`]). That is not a style choice to unify: the
//! npm CLI writes `new Date().toISOString()` here and strips the fraction
//! there, and a record whose stamp changed shape would read as a different
//! writer to anything comparing the two CLIs' output.
use crate::time_utc::{now_millis, utc_parts};

/// `YYYY-MM-DDTHH:MM:SS.mmmZ` for a unix-millisecond instant.
pub fn iso_millis(unix_millis: i64) -> String {
    let (y, mo, d, h, mi, s) = utc_parts(unix_millis.div_euclid(1000));
    let ms = unix_millis.rem_euclid(1000);
    format!("{y:04}-{mo:02}-{d:02}T{h:02}:{mi:02}:{s:02}.{ms:03}Z")
}

/// The current instant in that shape.
pub fn now_iso_millis() -> String {
    iso_millis(now_millis())
}

#[cfg(test)]
mod tests {
    #[test]
    fn keeps_milliseconds_unlike_a_trace_stamp() {
        assert_eq!(
            super::iso_millis(1_762_950_000_123),
            "2025-11-12T12:20:00.123Z"
        );
        assert_eq!(super::iso_millis(0), "1970-01-01T00:00:00.000Z");
    }
}
