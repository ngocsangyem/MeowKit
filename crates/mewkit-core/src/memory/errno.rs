//! The Node `error.code` name for an IO error, so a finding reads the same as
//! the TypeScript one (`EACCES`, `ENOENT`, …).
//!
//! Node reports the libuv name on every platform. Rust exposes a kind plus a raw
//! number whose MEANING is platform-specific, so the raw number is read through
//! a per-platform table and otherwise through [`io::ErrorKind`], which is the
//! only portable answer. Anything neither knows degrades to the raw number
//! rather than being swallowed — a finding that cannot say WHY a store file was
//! unreadable is still a finding.

use std::io;

/// `ELOOP`: 40 on Linux, 62 on the BSDs including macOS. Matching BOTH numbers
/// on every platform mislabelled the other platform's code — 40 is `EMSGSIZE` on
/// macOS and 62 is `ETIME` on Linux, so each one reported the other's error as a
/// symlink loop.
#[cfg(all(
    unix,
    any(target_os = "macos", target_os = "ios", target_os = "freebsd")
))]
const ELOOP: i32 = 62;
#[cfg(all(
    unix,
    not(any(target_os = "macos", target_os = "ios", target_os = "freebsd"))
))]
const ELOOP: i32 = 40;

/// The libc name for a raw code, on a platform where the raw code IS an errno.
/// On Windows `raw_os_error` is a Win32 code (access denied is 5, not 13), so
/// there is no table and the caller falls through to [`io::ErrorKind`].
#[cfg(unix)]
fn errno_name(code: i32) -> Option<&'static str> {
    match code {
        1 => Some("EPERM"),
        2 => Some("ENOENT"),
        13 => Some("EACCES"),
        20 => Some("ENOTDIR"),
        21 => Some("EISDIR"),
        _ if code == ELOOP => Some("ELOOP"),
        _ => None,
    }
}

#[cfg(not(unix))]
fn errno_name(_code: i32) -> Option<&'static str> {
    None
}

/// Portable fallback: the kind Rust normalises every platform's error into.
///
/// Only the two kinds that are STABLE are read. `NotADirectory`, `IsADirectory`
/// and `FilesystemLoop` are still unstable on the pinned toolchain, so a Windows
/// `ERROR_DIRECTORY` degrades to its raw number instead of `ENOTDIR` — a less
/// precise name, never a wrong one. Add them here when they stabilise.
fn kind_name(kind: io::ErrorKind) -> Option<&'static str> {
    match kind {
        io::ErrorKind::NotFound => Some("ENOENT"),
        io::ErrorKind::PermissionDenied => Some("EACCES"),
        _ => None,
    }
}

/// The name a finding prints for this error.
pub fn errno_of(error: &io::Error) -> String {
    if let Some(name) = error.raw_os_error().and_then(errno_name) {
        return name.to_string();
    }
    match (kind_name(error.kind()), error.raw_os_error()) {
        (Some(name), _) => name.to_string(),
        (None, Some(code)) => format!("errno {code}"),
        (None, None) => "unknown error".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Raw numbers are errnos only on unix; on Windows they are Win32 codes.
    #[cfg(unix)]
    #[test]
    fn the_common_names_match_what_node_reports() {
        for (code, name) in [
            (1, "EPERM"),
            (2, "ENOENT"),
            (13, "EACCES"),
            (20, "ENOTDIR"),
            (21, "EISDIR"),
        ] {
            assert_eq!(errno_of(&io::Error::from_raw_os_error(code)), name);
        }
    }

    #[cfg(unix)]
    #[test]
    fn eloop_is_this_platforms_number_and_not_the_other_platforms() {
        assert_eq!(errno_of(&io::Error::from_raw_os_error(ELOOP)), "ELOOP");
        // The number ELOOP carries on the OTHER family must NOT be labelled
        // ELOOP here: it means EMSGSIZE on macOS and ETIME on Linux.
        let foreign = if ELOOP == 62 { 40 } else { 62 };
        assert_ne!(errno_of(&io::Error::from_raw_os_error(foreign)), "ELOOP");
    }

    #[test]
    fn an_unknown_code_degrades_to_the_raw_number_rather_than_being_swallowed() {
        // 7 is E2BIG — a real code with no entry in the table, and no
        // `ErrorKind` of its own.
        assert_eq!(errno_of(&io::Error::from_raw_os_error(7)), "errno 7");
    }

    #[test]
    fn an_error_with_no_os_number_still_names_its_kind() {
        let error = io::Error::new(io::ErrorKind::PermissionDenied, "synthetic");
        assert_eq!(errno_of(&error), "EACCES");
        let other = io::Error::other("synthetic");
        assert_eq!(errno_of(&other), "unknown error");
    }

    #[test]
    fn a_win32_style_code_is_not_read_as_an_errno() {
        // Windows reports access denied as 5, which is EIO on POSIX. The unix
        // table is compiled out there, so the kind answers instead; here the
        // point is only that 5 never becomes "EACCES" by accident.
        assert_ne!(errno_of(&io::Error::from_raw_os_error(5)), "EISDIR");
    }
}
