//! Take the one binary out of a release archive (`.tar.gz`). Only a regular
//! file named like the binary, at the top or one directory down, is taken;
//! nothing else in the archive is written anywhere.
use std::io::Read;

use crate::kit::KitError;

/// Largest binary accepted after decompression.
const MAX_BINARY_BYTES: u64 = 128 * 1024 * 1024;

pub fn binary_name() -> &'static str {
    if cfg!(windows) {
        "mewkit-next.exe"
    } else {
        "mewkit-next"
    }
}

/// The bytes of `name` inside the gzipped tar `archive`.
pub fn binary_from(archive: &[u8], name: &str) -> Result<Vec<u8>, KitError> {
    let bad = |why: String| KitError::Unsafe(format!("binary archive: {why}"));
    let mut tar = tar::Archive::new(flate2::read::GzDecoder::new(archive));
    let entries = tar.entries().map_err(|e| bad(e.to_string()))?;
    for entry in entries {
        let entry = entry.map_err(|e| bad(e.to_string()))?;
        let path = entry.path().map_err(|e| bad(e.to_string()))?.into_owned();
        let parts: Vec<_> = path.components().collect();
        let named = path.file_name().is_some_and(|f| f == name);
        if !named || parts.len() > 2 || !entry.header().entry_type().is_file() {
            continue;
        }
        let mut bytes = Vec::new();
        entry
            .take(MAX_BINARY_BYTES + 1)
            .read_to_end(&mut bytes)
            .map_err(|e| bad(e.to_string()))?;
        if bytes.len() as u64 > MAX_BINARY_BYTES {
            return Err(bad(format!(
                "{name} is larger than {MAX_BINARY_BYTES} bytes"
            )));
        }
        if bytes.is_empty() {
            return Err(bad(format!("{name} is empty")));
        }
        return Ok(bytes);
    }
    Err(bad(format!("no {name} in the archive")))
}
