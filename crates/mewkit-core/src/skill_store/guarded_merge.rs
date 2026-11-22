//! Which edited kit files in a skill an upgrade merges instead of keeping.
//!
//! A skill is merged only as a whole: every file in it the user edited and
//! the new kit writes must pass, or none is merged and each stays as the
//! user left it (the upgrade then reports it kept and exits 6, as before).
//! A file passes when all of these hold:
//!
//! 1. the previous kit's bytes for the path are available (from the kit
//!    cache) and hash to what the ledger recorded at install, so the merge
//!    base is the file the user actually started from;
//! 2. [`crate::merge::text3::merge3`] merges the two edits: they are
//!    separated by an unchanged region with a unique line, and no hunk
//!    touches frontmatter or a gate line;
//! 3. the skill has eval cases, so a merged skill can be measured.
//!
//! The merged skill is then checked as staged: each merged file still opens
//! with the new kit's frontmatter. Reads only; the caller applies the result
//! through the executor's journal, so the skill is swapped as one unit.
use std::collections::BTreeMap;

use super::rows::skill_key_of;
use crate::exec::{MergedFile, Merges};
use crate::fsx::{RelPath, sha256_hex};
use crate::merge::text3::{merge3, same_frontmatter};
use crate::plan::Op;

/// What the merge needs to know about the run, as lookups.
pub struct Inputs<'a> {
    pub ops: &'a [Op],
    /// The ledger: SHA-256 recorded at install, by root-relative path.
    pub ledger: &'a BTreeMap<String, String>,
    /// The previous kit's bytes at a path; `None` when that kit is not
    /// available or did not ship the path.
    pub base: &'a dyn Fn(&str) -> Option<Vec<u8>>,
    /// The file on disk now.
    pub current: &'a dyn Fn(&RelPath) -> Option<Vec<u8>>,
    /// Whether the skill of this name has eval cases.
    pub has_cases: &'a dyn Fn(&str) -> bool,
}

/// One skill merged as a whole.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SkillMerge {
    pub key: String,
    pub name: String,
    pub files: Vec<String>,
}

#[derive(Debug, Default)]
pub struct Planned {
    pub merges: Merges,
    pub skills: Vec<SkillMerge>,
    /// (path, why it was not merged), for every edited file left as it is.
    pub refused: Vec<(String, String)>,
}

/// One edited file the new kit writes: (path, the kit's new bytes, disk bytes).
type Candidate = (RelPath, Vec<u8>, Vec<u8>);

/// The merges for every skill in `inputs.ops` that passes as a whole.
pub fn plan(inputs: &Inputs) -> Planned {
    let mut by_skill: BTreeMap<String, Vec<Candidate>> = BTreeMap::new();
    for op in inputs.ops {
        let Op::WriteFile { path, bytes, .. } = op else {
            continue;
        };
        let key = skill_key_of(path.as_str());
        let (Some(key), Some(recorded)) = (key, inputs.ledger.get(path.as_str())) else {
            continue;
        };
        let Some(current) = (inputs.current)(path) else {
            continue;
        };
        if sha256_hex(&current) == *recorded || current == *bytes {
            continue;
        }
        by_skill
            .entry(key.to_owned())
            .or_default()
            .push((path.clone(), bytes.clone(), current));
    }
    let mut out = Planned::default();
    for (key, files) in by_skill {
        let dir = key.rsplit('/').next().unwrap_or(&key);
        let name = dir.strip_prefix("mk-").unwrap_or(dir).to_owned();
        match merge_skill(inputs, &name, &files) {
            Ok(merged) => {
                out.skills.push(SkillMerge {
                    key,
                    name,
                    files: files.iter().map(|(p, ..)| p.to_string()).collect(),
                });
                out.merges.extend(merged);
            }
            Err((bad, why)) => {
                for (path, ..) in &files {
                    let reason = if *path == bad {
                        why.clone()
                    } else {
                        format!("{bad} in the same skill could not be merged")
                    };
                    out.refused.push((path.to_string(), reason));
                }
            }
        }
    }
    out
}

/// Every file of one skill merged, or the first file that refused and why.
fn merge_skill(
    inputs: &Inputs,
    name: &str,
    files: &[Candidate],
) -> Result<Vec<(RelPath, MergedFile)>, (RelPath, String)> {
    let mut merged = Vec::new();
    for (path, theirs, ours) in files {
        let refuse = |why: &str| (path.clone(), why.to_owned());
        if !(inputs.has_cases)(name) {
            return Err(refuse(
                "the skill has no eval cases (install the eval pack)",
            ));
        }
        let base = (inputs.base)(path.as_str())
            .ok_or_else(|| refuse("the previous kit is not in the cache"))?;
        if Some(&sha256_hex(&base)) != inputs.ledger.get(path.as_str()) {
            return Err(refuse(
                "the cached previous kit does not match what was installed",
            ));
        }
        let text = |b: &[u8]| String::from_utf8(b.to_vec()).map_err(|_| refuse("not a text file"));
        let (base, ours_t, theirs_t) = (text(&base)?, text(ours)?, text(theirs)?);
        let bytes = merge3(&base, &ours_t, &theirs_t).map_err(|e| refuse(&e.to_string()))?;
        if !same_frontmatter(&bytes, &theirs_t) {
            return Err(refuse(
                "the merged file does not keep the kit's frontmatter",
            ));
        }
        merged.push((
            path.clone(),
            MergedFile {
                bytes: bytes.into_bytes(),
                against: sha256_hex(ours),
            },
        ));
    }
    Ok(merged)
}
