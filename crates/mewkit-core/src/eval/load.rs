//! Find and load every case under a case root, and fingerprint the set.
//!
//! Layout: `<root>/<skill>/eval/*.yaml` (or `.yml`), each file holding
//! `cases: [...]`. The root is a parameter because the kit's own cases live
//! beside its skills while an opt-in pack ships them elsewhere.
//!
//! The case-set hash covers every case file and every fixture file a case
//! names, so two reports agree on it only when they ran the same inputs.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use serde::Deserialize;
use sha2::{Digest, Sha256};

use super::case::{CaseError, EvalCase};
use super::load_fs::{hash_fixture, read_regular, real_dir, sorted_entries};
use crate::fsx::RelPath;
use crate::yaml_doc;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LoadedCase {
    pub case: EvalCase,
    /// The case file, relative to the case root.
    pub file: RelPath,
    /// The fixture directory, relative to the case root, when the case names one.
    pub fixture_dir: Option<RelPath>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CaseSet {
    pub cases: Vec<LoadedCase>,
    /// Lowercase hex SHA-256 over case files and fixture files.
    pub hash: String,
}

#[derive(Debug, thiserror::Error)]
pub enum LoadError {
    #[error("cannot read {path}: {source}")]
    Io {
        path: PathBuf,
        source: std::io::Error,
    },
    #[error("{path}: {reason}")]
    Parse { path: String, reason: String },
    #[error("{path}: {source}")]
    Invalid { path: String, source: CaseError },
    #[error("{path} is a symlink; case files, fixtures and the folders above them must be real")]
    Symlink { path: String },
    #[error("{path}: file name is not UTF-8")]
    BadName { path: String },
    #[error("case id {id:?} appears in both {first} and {second}")]
    DuplicateId {
        id: String,
        first: String,
        second: String,
    },
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct CaseFile {
    cases: Vec<EvalCase>,
}

/// Load every case under `root`, refusing the whole set on the first bad file:
/// a partial set would produce a report whose hash names cases it never ran.
pub fn load_cases(root: &Path) -> Result<CaseSet, LoadError> {
    // Path (relative, `/`-joined) -> bytes, sorted, for the fingerprint.
    let mut hashed: BTreeMap<String, Vec<u8>> = BTreeMap::new();
    let mut cases = Vec::new();
    let mut seen: BTreeMap<String, String> = BTreeMap::new();

    for skill_dir in sorted_entries(root, false)? {
        let Some(eval_dir) = real_dir(root, &format!("{skill_dir}/eval"))? else {
            continue;
        };
        for name in sorted_entries(&eval_dir, false)? {
            if !(name.ends_with(".yaml") || name.ends_with(".yml")) {
                continue;
            }
            let rel = format!("{skill_dir}/eval/{name}");
            let bytes = read_regular(&eval_dir.join(&name), &rel)?;
            let text = String::from_utf8(bytes.clone()).map_err(|_| LoadError::Parse {
                path: rel.clone(),
                reason: "not UTF-8".into(),
            })?;
            let file: CaseFile = yaml_doc::parse_value(&text)
                .map_err(|e| e.to_string())
                .and_then(|v| serde_json::from_value(v).map_err(|e| e.to_string()))
                .map_err(|reason| LoadError::Parse {
                    path: rel.clone(),
                    reason,
                })?;
            hashed.insert(rel.clone(), bytes);

            for case in file.cases {
                let invalid = |source| LoadError::Invalid {
                    path: rel.clone(),
                    source,
                };
                case.validate().map_err(invalid)?;
                if case.skill != skill_dir {
                    return Err(invalid(CaseError {
                        id: case.id.clone(),
                        reason: format!(
                            "skill {:?} does not match its folder {skill_dir:?}",
                            case.skill
                        ),
                    }));
                }
                if let Some(first) = seen.insert(case.id.clone(), rel.clone()) {
                    return Err(LoadError::DuplicateId {
                        id: case.id.clone(),
                        first,
                        second: rel.clone(),
                    });
                }
                let fixture_dir = match &case.fixture {
                    Some(f) => Some(hash_fixture(
                        root,
                        &format!("{skill_dir}/eval/{f}"),
                        &mut hashed,
                    )?),
                    None => None,
                };
                let file = RelPath::new(&rel).map_err(|e| LoadError::Parse {
                    path: rel.clone(),
                    reason: e.to_string(),
                })?;
                cases.push(LoadedCase {
                    case,
                    file,
                    fixture_dir,
                });
            }
        }
    }

    let mut h = Sha256::new();
    for (path, bytes) in &hashed {
        h.update(path.as_bytes());
        h.update([0]);
        h.update((bytes.len() as u64).to_le_bytes());
        h.update(bytes);
    }
    let hash = h.finalize().iter().map(|b| format!("{b:02x}")).collect();
    Ok(CaseSet { cases, hash })
}
