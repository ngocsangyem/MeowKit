//! `checksums.txt` in `sha256sum` format: `<64 hex>  <file name>` per line.
use super::KitError;
use crate::fsx::sha256_hex;

/// The expected SHA-256 for `file` in a `checksums.txt` body.
pub fn expected_for(checksums: &str, file: &str) -> Result<String, KitError> {
    for line in checksums.lines() {
        let mut parts = line.split_whitespace();
        let (Some(hex), Some(name)) = (parts.next(), parts.next()) else {
            continue;
        };
        // `sha256sum` marks binary mode with a leading `*` on the name.
        if name.trim_start_matches('*') == file {
            if hex.len() == 64 && hex.bytes().all(|b| b.is_ascii_hexdigit()) {
                return Ok(hex.to_ascii_lowercase());
            }
            return Err(KitError::Checksum(format!(
                "checksums.txt has a malformed digest for {file}"
            )));
        }
    }
    Err(KitError::Checksum(format!(
        "checksums.txt has no entry for {file}"
    )))
}

/// Refuse `bytes` unless their SHA-256 is `expected` (case-insensitive hex).
pub fn verify(bytes: &[u8], expected: &str, what: &str) -> Result<String, KitError> {
    let actual = sha256_hex(bytes);
    if actual.eq_ignore_ascii_case(expected) {
        Ok(actual)
    } else {
        Err(KitError::Checksum(format!(
            "{what} has SHA-256 {actual}, expected {expected}; refusing to install it"
        )))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const DIGEST: &str = "a3f1c0ffee00000000000000000000000000000000000000000000000000beef";

    #[test]
    fn finds_the_named_entry_in_either_mode() {
        let body = format!("{DIGEST}  meowkit-release.zip\n");
        assert_eq!(expected_for(&body, "meowkit-release.zip").unwrap(), DIGEST);
        let binary = format!(
            "other  x\n{}  *meowkit-release.zip\n",
            DIGEST.to_uppercase()
        );
        assert_eq!(
            expected_for(&binary, "meowkit-release.zip").unwrap(),
            DIGEST
        );
    }

    #[test]
    fn missing_or_malformed_entries_are_errors() {
        assert!(expected_for("", "meowkit-release.zip").is_err());
        assert!(expected_for("abc  meowkit-release.zip\n", "meowkit-release.zip").is_err());
    }

    #[test]
    fn verify_refuses_a_mismatch() {
        let good = sha256_hex(b"kit");
        assert_eq!(verify(b"kit", &good, "zip").unwrap(), good);
        let err = verify(b"tampered", &good, "zip").unwrap_err();
        assert!(err.to_string().contains("refusing"));
    }
}
