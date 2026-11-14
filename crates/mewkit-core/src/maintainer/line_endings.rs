//! Line-ending folding for committed text that a checkout may rewrite.
//!
//! A Windows checkout with `core.autocrlf` turns LF text into CRLF, which is
//! not content drift. Everything generated here is rendered with LF, so inputs
//! are folded to LF before they are hashed or spliced, and a rewrite then
//! writes LF (git re-normalizes it on commit).
use std::borrow::Cow;

/// `text` with every CRLF folded to LF; borrowed when there is nothing to fold.
pub fn fold_crlf(text: &str) -> Cow<'_, str> {
    if text.contains("\r\n") {
        Cow::Owned(text.replace("\r\n", "\n"))
    } else {
        Cow::Borrowed(text)
    }
}

/// SHA-256 of a source file's content, line-ending agnostic for text.
///
/// Bytes that are not UTF-8 (or hold a NUL) are binary and hashed as they are:
/// folding a `\r\n` pair inside binary data would corrupt it. For an LF file
/// the digest equals the digest of the raw bytes.
pub fn source_hash(bytes: &[u8]) -> String {
    match std::str::from_utf8(bytes) {
        Ok(text) if !bytes.contains(&0) => crate::fsx::sha256_hex(fold_crlf(text).as_bytes()),
        _ => crate::fsx::sha256_hex(bytes),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::maintainer::reference_render::{splice_index, splice_reference_facts};

    #[test]
    fn crlf_and_lf_sources_hash_alike() {
        let lf = b"---\nname: x\n---\nbody\n";
        let crlf = b"---\r\nname: x\r\n---\r\nbody\r\n";
        assert_eq!(source_hash(lf), source_hash(crlf));
        assert_eq!(source_hash(lf), crate::fsx::sha256_hex(lf));
    }

    #[test]
    fn binary_bytes_are_hashed_raw() {
        let bin = [0u8, 13, 10, 255];
        assert_eq!(source_hash(&bin), crate::fsx::sha256_hex(&bin));
    }

    #[test]
    fn splicing_a_crlf_page_matches_the_lf_page() {
        let lf = "---\ntitle: T\n---\nintro\n";
        let crlf = lf.replace('\n', "\r\n");
        let block = "<!-- facts -->";
        assert_eq!(
            splice_reference_facts(&fold_crlf(&crlf), block),
            splice_reference_facts(lf, block)
        );
        assert_eq!(
            splice_index(&fold_crlf(&crlf), block),
            splice_index(lf, block)
        );
    }
}
