//! Shape-validating one parsed manifest.
//!
//! Every refusal names the field, because the caller prints it as a row and a
//! "manifest is invalid" with no field is unactionable.
use serde_json::Value;

use super::pack_manifest::{PackBase, PackDef, PackManifest, PackManifestError};

fn string_vec(value: Option<&Value>) -> Vec<String> {
    value
        .and_then(Value::as_array)
        .map(|values| values.iter().map(json_to_string).collect())
        .unwrap_or_default()
}

/// `String(value)` for the shapes a manifest can carry.
pub(super) fn json_to_string(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        other => other.to_string(),
    }
}

pub(super) fn validate_manifest(parsed: &Value) -> Result<PackManifest, PackManifestError> {
    let Some(root) = parsed.as_object() else {
        return Err(PackManifestError("manifest root is not an object".into()));
    };
    let base = root.get("base").and_then(Value::as_object);
    let files = base.and_then(|b| b.get("files")).and_then(Value::as_array);
    let globs = base.and_then(|b| b.get("globs")).and_then(Value::as_array);
    if files.is_none() || globs.is_none() {
        return Err(PackManifestError(
            "manifest.base must have array fields files/globs".into(),
        ));
    }
    let Some(packs) = root.get("packs").and_then(Value::as_object) else {
        return Err(PackManifestError("manifest.packs must be an object".into()));
    };
    let Some(profiles) = root.get("profiles").and_then(Value::as_object) else {
        return Err(PackManifestError(
            "manifest.profiles must be an object".into(),
        ));
    };
    let mut flat_profiles = Vec::new();
    for (name, entry) in profiles {
        let Some(refs) = entry.as_array() else {
            return Err(PackManifestError(format!(
                "profile \"{name}\" must be an array of pack/profile refs"
            )));
        };
        flat_profiles.push((
            name.clone(),
            refs.iter().map(json_to_string).collect::<Vec<String>>(),
        ));
    }
    let flat_packs = packs
        .iter()
        .map(|(name, def)| {
            (
                name.clone(),
                PackDef {
                    owners: string_vec(def.get("owners")),
                    artifacts_add: string_vec(def.get("artifactsAdd")),
                    artifacts_exclude: string_vec(def.get("artifactsExclude")),
                },
            )
        })
        .collect();
    Ok(PackManifest {
        schema_version: root
            .get("schemaVersion")
            .and_then(Value::as_str)
            .unwrap_or("1.0")
            .to_string(),
        base: PackBase {
            files: string_vec(base.and_then(|b| b.get("files"))),
            globs: string_vec(base.and_then(|b| b.get("globs"))),
            exclude: string_vec(base.and_then(|b| b.get("exclude"))),
        },
        packs: flat_packs,
        profiles: flat_profiles,
    })
}
