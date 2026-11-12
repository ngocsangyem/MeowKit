//! Reading the install baseline, with the precedence the npm CLI applies:
//! canonical (`schemaVersion` present) > version-only > none.
//!
//! The order is load-bearing. A project must never end up with TWO baselines,
//! because which one wins would then depend on read order — and that is how one
//! upgrade keeps a user edit and the next overwrites it.

use serde_json::Value;

use super::install_metadata::{
    CorruptInstallMetadata, INSTALL_METADATA_SCHEMA_VERSION, InstallMetadata,
};

/// Which record a read of the install metadata came from. `legacy-metadata` is a
/// version-only file an older CLI wrote; `none` means no baseline exists.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MetadataSource {
    New,
    LegacyMetadata,
    None,
}

/// Classify an already-read `metadata.json` payload with the TS precedence:
/// canonical (`schemaVersion` present) > version-only > none. Returns the
/// synthesized minimal record for the legacy case, exactly as the TS reader does.
pub fn classify(
    payload: Option<&Value>,
) -> Result<(MetadataSource, Option<InstallMetadata>), CorruptInstallMetadata> {
    let Some(Value::Object(obj)) = payload else {
        return Ok((MetadataSource::None, None));
    };
    if obj.contains_key("schemaVersion") {
        let meta = InstallMetadata::parse(payload.expect("checked above"))?;
        return Ok((MetadataSource::New, Some(meta)));
    }
    if let Some(version) = obj.get("version").and_then(Value::as_str) {
        return Ok((
            MetadataSource::LegacyMetadata,
            Some(InstallMetadata {
                schema_version: INSTALL_METADATA_SCHEMA_VERSION.to_string(),
                tool: super::install_metadata::default_tool(),
                version: version.to_string(),
                scope: None,
                installed_at: String::new(),
                files: Vec::new(),
                settings: None,
                profile: None,
                packs: None,
                provenance: None,
            }),
        ));
    }
    Ok((MetadataSource::None, None))
}

#[cfg(test)]
#[path = "install_metadata_read_tests.rs"]
mod tests;
