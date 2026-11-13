//! Reading a directory in the order Node reads it.
//!
//! This is not a cosmetic choice. `fs.readdirSync` goes through libuv's
//! `uv_fs_scandir`, which calls POSIX `scandir()` with `alphasort` — so Node
//! hands back a SORTED list, while `std::fs::read_dir` hands back raw directory
//! order (hash order on APFS). Every row order, every "first ten findings"
//! detail and every scanned-file sequence in this module therefore depends on
//! sorting here: without it the two CLIs print the same rows in a different
//! order, which reads as a behaviour difference and is not one.
//!
//! `alphasort` compares with `strcoll`, and Node sets no locale, so the C
//! locale applies and the comparison is byte order — which is what `sort` on a
//! Rust `OsString`'s bytes does.
use std::ffi::OsString;
use std::fs::DirEntry;
use std::path::Path;

/// Every entry of `dir`, in Node's order. An unreadable directory yields an
/// empty list, the way `readdirSync` inside a `try` does for its callers here.
pub fn sorted_entries(dir: &Path) -> Vec<DirEntry> {
    let Ok(read) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut entries: Vec<DirEntry> = read.filter_map(Result::ok).collect();
    entries.sort_by_key(|entry| sort_key(&entry.file_name()));
    entries
}

/// Just the names, for a caller that does not need the entry.
pub fn sorted_names(dir: &Path) -> Vec<String> {
    sorted_entries(dir)
        .iter()
        .map(|entry| entry.file_name().to_string_lossy().into_owned())
        .collect()
}

#[cfg(unix)]
fn sort_key(name: &OsString) -> Vec<u8> {
    use std::os::unix::ffi::OsStrExt;
    name.as_os_str().as_bytes().to_vec()
}

/// Windows names are UTF-16; libuv sorts them with `wcscmp`, i.e. by code unit,
/// which for the ASCII names in a kit is the same order as the UTF-8 bytes.
#[cfg(not(unix))]
fn sort_key(name: &OsString) -> Vec<u8> {
    name.to_string_lossy().into_owned().into_bytes()
}

#[cfg(test)]
#[path = "dir_order_tests.rs"]
mod dir_order_tests;
