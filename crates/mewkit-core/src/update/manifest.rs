//! `binary-manifest.json`, published with every `mewkit-v*` release: which
//! archive each target downloads and the SHA-256 and size it must have.
//! There is no signature; the manifest is trusted as served over TLS from
//! this repository's releases, and its URLs may point nowhere else.
use std::collections::BTreeMap;

use serde::Deserialize;

use crate::kit::KitError;
use crate::kit::select::Version;

/// Every archive URL must sit under this repository's release downloads.
pub const DOWNLOAD_PREFIX: &str = "https://github.com/ngocsangyem/MeowKit/releases/download/";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct Manifest {
    pub version: String,
    pub channel: String,
    pub published_at: String,
    /// Versions below this are withdrawn; their users should update.
    pub min_supported: String,
    pub targets: BTreeMap<String, Target>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Target {
    pub url: String,
    pub sha256: String,
    pub size: u64,
}

impl Manifest {
    /// Parse and check every field the update relies on.
    pub fn parse(bytes: &[u8]) -> Result<Self, KitError> {
        let bad = |why: String| KitError::Checksum(format!("binary-manifest.json: {why}"));
        let m: Self = serde_json::from_slice(bytes).map_err(|e| bad(e.to_string()))?;
        for (field, v) in [("version", &m.version), ("min_supported", &m.min_supported)] {
            if version(v).is_none() {
                return Err(bad(format!("{field} {v:?} is not a version")));
            }
        }
        if version(&m.min_supported) > version(&m.version) {
            return Err(bad(format!(
                "min_supported {} is above version {}",
                m.min_supported, m.version
            )));
        }
        if !matches!(m.channel.as_str(), "stable" | "beta") {
            return Err(bad(format!("unknown channel {:?}", m.channel)));
        }
        for (name, t) in &m.targets {
            let hex = t.sha256.len() == 64 && t.sha256.bytes().all(|b| b.is_ascii_hexdigit());
            if !hex {
                return Err(bad(format!("{name}: malformed sha256")));
            }
            // Only an asset of this very binary release.
            let own = format!("{DOWNLOAD_PREFIX}{}{}/", super::TAG_PREFIX, m.version);
            let rest = t.url.strip_prefix(&own).unwrap_or_default();
            if rest.is_empty() || rest.contains(['/', '%', '?', '#']) || rest.contains("..") {
                return Err(bad(format!(
                    "{name}: {} is not a release of this repository",
                    t.url
                )));
            }
            if t.size == 0 {
                return Err(bad(format!("{name}: size is zero")));
            }
        }
        Ok(m)
    }
}

/// `1.2.3` or `1.2.3-beta.1`, with or without a leading `v`.
pub fn version(v: &str) -> Option<Version> {
    Version::parse(&format!("v{}", v.strip_prefix('v').unwrap_or(v)))
}

/// The release target this binary was built for, as manifests name it.
pub fn current_target() -> Option<&'static str> {
    let t = match (std::env::consts::OS, std::env::consts::ARCH) {
        ("linux", "x86_64") => "x86_64-unknown-linux-musl",
        ("linux", "aarch64") => "aarch64-unknown-linux-musl",
        ("macos", "x86_64") => "x86_64-apple-darwin",
        ("macos", "aarch64") => "aarch64-apple-darwin",
        ("windows", "x86_64") => "x86_64-pc-windows-msvc",
        ("windows", "aarch64") => "aarch64-pc-windows-msvc",
        _ => return None,
    };
    Some(t)
}
