//! Turn each op into a concrete action against what is on disk now.
//!
//! Deciding reads but never writes, so a dry run is exactly this step, and the
//! backup set is exactly the paths a decision will change.
use crate::fsx::{RelPath, sha256_hex};
use crate::merge::{hook_groups, json_entries, markdown_block, toml_table};
use crate::ownership::{OwnershipIndex, Section};
use crate::plan::{Format, Op};

use super::ExecError;

pub(super) enum Action {
    Write {
        bytes: Vec<u8>,
        mode: Option<u32>,
    },
    Remove,
    /// Nothing to change on disk; only the index is updated.
    Unchanged,
    /// Left alone on purpose; the reason is reported.
    Preserve(String),
}

/// How the ownership index changes once the action is applied.
pub(super) enum Record {
    None,
    OwnFile(String),
    DisownFile,
    AddSection(String, Section),
    DropSection(String),
}

pub(super) struct Decision {
    pub path: RelPath,
    pub action: Action,
    pub record: Record,
    pub replaced: Vec<String>,
}

pub(super) fn decide(
    op: &Op,
    current: Option<Vec<u8>>,
    index: &OwnershipIndex,
    kit_hash: &dyn Fn(&RelPath) -> Option<String>,
    force: bool,
) -> Result<Decision, ExecError> {
    let path = op.path().clone();
    let owned = index.paths.get(path.as_str());
    let sections = index.sections.get(path.as_str());
    let text = || -> Result<String, ExecError> {
        String::from_utf8(current.clone().unwrap_or_default())
            .map_err(|_| ExecError::Merge(path.to_string(), "file is not UTF-8".into()))
    };
    let mut replaced = Vec::new();
    let (action, record) = match op {
        Op::WriteFile { bytes, mode, .. } => {
            let record = Record::OwnFile(sha256_hex(bytes));
            let action = match (&current, owned) {
                (None, _) => Action::Write {
                    bytes: bytes.clone(),
                    mode: *mode,
                },
                (Some(cur), _) if cur == bytes => Action::Unchanged,
                (Some(cur), Some(rec)) if sha256_hex(cur) == *rec || force => Action::Write {
                    bytes: bytes.clone(),
                    mode: *mode,
                },
                (Some(_), Some(_)) => Action::Preserve("edited since install (use --force)".into()),
                (Some(_), None) if force => Action::Write {
                    bytes: bytes.clone(),
                    mode: *mode,
                },
                (Some(_), None) => {
                    Action::Preserve("exists and was not installed by mewkit (use --force)".into())
                }
            };
            match action {
                Action::Preserve(_) => (action, Record::None),
                _ => (action, record),
            }
        }
        Op::RemoveFile { .. } => match (&current, owned) {
            (_, None) => (
                Action::Preserve("not owned by this install".into()),
                Record::None,
            ),
            (None, Some(_)) => (Action::Unchanged, Record::DisownFile),
            (Some(cur), Some(rec)) => {
                let actual = sha256_hex(cur);
                match kit_hash(&path) {
                    None => (
                        Action::Preserve(
                            "the kit does not ship this path, so ownership is not corroborated"
                                .into(),
                        ),
                        Record::None,
                    ),
                    Some(kit) if actual == *rec && actual == kit => {
                        (Action::Remove, Record::DisownFile)
                    }
                    Some(_) if force => (Action::Remove, Record::DisownFile),
                    Some(_) => (
                        Action::Preserve("edited since install (use --force)".into()),
                        Record::None,
                    ),
                }
            }
        },
        Op::MergeBlock { id, content, .. } => {
            let merged =
                markdown_block::merge(&text()?, id, content).map_err(|e| merge_err(&path, e))?;
            let section = Section {
                format: Format::Markdown,
                key: vec![],
                names: vec![],
                created: 0,
                file_created: keep_created(sections, id, current.is_none()),
            };
            (
                write_if_changed(&current, merged, None),
                Record::AddSection(id.clone(), section),
            )
        }
        Op::StripBlock { id, .. } => match sections.and_then(|s| s.get(id)) {
            None => (
                Action::Preserve(format!("block {id:?} is not recorded as installed")),
                Record::None,
            ),
            Some(sec) => {
                let stripped =
                    markdown_block::strip(&text()?, id).map_err(|e| merge_err(&path, e))?;
                (
                    strip_action(&current, stripped, sec, ""),
                    Record::DropSection(id.clone()),
                )
            }
        },
        Op::MergeEntries {
            format,
            key,
            entries,
            ..
        } => {
            let keys: Vec<&str> = key.iter().map(String::as_str).collect();
            let names: Vec<String> = entries.keys().cloned().collect();
            let gone = stale(sections.and_then(|s| s.get(&key.join("."))), &names);
            let base = match format {
                _ if gone.is_empty() => text()?,
                Format::Json => json_entries::strip(&text()?, &keys, &gone, 0)
                    .map_err(|e| merge_err(&path, e))?,
                Format::Toml => {
                    toml_table::strip(&text()?, &keys, &gone, 0).map_err(|e| merge_err(&path, e))?
                }
                Format::Markdown => text()?,
            };
            let out = match format {
                Format::Json => json_entries::merge(&base, &keys, entries),
                Format::Toml => toml_table::merge(&base, &keys, entries),
                Format::Markdown => {
                    return Err(ExecError::Merge(
                        path.to_string(),
                        "entries need JSON or TOML".into(),
                    ));
                }
            }
            .map_err(|e| merge_err(&path, e))?;
            let id = key.join(".");
            let prior = sections.and_then(|s| s.get(&id));
            // An entry the user already had with the kit's value stays theirs,
            // unless an earlier install of the kit is what put it there.
            let names = names
                .into_iter()
                .filter(|n| !out.already.contains(n) || prior.is_some_and(|p| p.names.contains(n)))
                .collect();
            let section = Section {
                format: *format,
                key: key.clone(),
                names,
                // A re-merge creates nothing; keep what the first merge created.
                created: prior.map_or(out.created, |p| p.created.max(out.created)),
                file_created: keep_created(sections, &id, current.is_none()),
            };
            replaced = out
                .replaced
                .iter()
                .map(|n| format!("{path}: {n}"))
                .collect();
            (
                write_if_changed(&current, out.text, None),
                Record::AddSection(id, section),
            )
        }
        Op::StripEntries {
            format, key, names, ..
        } => {
            let id = key.join(".");
            match sections.and_then(|s| s.get(&id)) {
                None => (
                    Action::Preserve(format!(
                        "entries under {id:?} are not recorded as installed"
                    )),
                    Record::None,
                ),
                Some(sec) => {
                    let keys: Vec<&str> = key.iter().map(String::as_str).collect();
                    let stripped = match format {
                        Format::Json => json_entries::strip(&text()?, &keys, names, sec.created),
                        Format::Toml => toml_table::strip(&text()?, &keys, names, sec.created),
                        Format::Markdown => {
                            return Err(ExecError::Merge(
                                path.to_string(),
                                "entries need JSON or TOML".into(),
                            ));
                        }
                    }
                    .map_err(|e| merge_err(&path, e))?;
                    let empty = if *format == Format::Json { "{}\n" } else { "" };
                    (
                        strip_action(&current, stripped, sec, empty),
                        Record::DropSection(id),
                    )
                }
            }
        }
        Op::MergeHooks {
            event,
            handlers,
            layout,
            ..
        } => {
            let id = hooks_section_id(event);
            let prior = sections.and_then(|s| s.get(&id));
            let names = handlers
                .iter()
                .map(hook_groups::Handler::id)
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| merge_err(&path, e))?;
            // Handlers an earlier kit installed and this one dropped come out
            // first, or an upgrade would leave them pointing at removed scripts.
            let base = match stale(prior, &names) {
                gone if gone.is_empty() => text()?,
                gone => hook_groups::strip(&text()?, event, &gone, 0, *layout)
                    .map_err(|e| merge_err(&path, e))?,
            };
            let out = hook_groups::merge(&base, event, handlers, *layout)
                .map_err(|e| merge_err(&path, e))?;
            // `hooks` is created by the first event merged into the file; later
            // events inherit that, so whichever is stripped last removes it.
            let hooks_created = sections.is_some_and(|s| {
                s.iter()
                    .any(|(k, v)| k.starts_with("hooks.") && v.created >= 2)
            });
            let created = if out.created == 1 && hooks_created {
                2
            } else {
                out.created
            };
            let section = Section {
                format: Format::Json,
                key: vec!["hooks".into(), event.clone()],
                names,
                created: prior.map_or(created, |p| p.created.max(created)),
                file_created: keep_created(sections, &id, current.is_none()),
            };
            replaced = out
                .replaced
                .iter()
                .map(|n| format!("{path}: {}", n.replace('\u{1f}', " ")))
                .collect();
            (
                write_if_changed(&current, out.text, None),
                Record::AddSection(id, section),
            )
        }
        Op::StripHooks {
            event, ids, layout, ..
        } => {
            let id = hooks_section_id(event);
            match sections.and_then(|s| s.get(&id)) {
                None => (
                    Action::Preserve(format!("hooks for {event:?} are not recorded as installed")),
                    Record::None,
                ),
                Some(sec) => {
                    let stripped = hook_groups::strip(&text()?, event, ids, sec.created, *layout)
                        .map_err(|e| merge_err(&path, e))?;
                    (
                        strip_action(&current, stripped, sec, "{}\n"),
                        Record::DropSection(id),
                    )
                }
            }
        }
    };
    Ok(Decision {
        path,
        action,
        record,
        replaced,
    })
}

/// Names a prior install recorded in this section that the new merge no longer carries.
fn stale(prior: Option<&Section>, names: &[String]) -> Vec<String> {
    prior.map_or_else(Vec::new, |p| {
        p.names
            .iter()
            .filter(|n| !names.contains(n))
            .cloned()
            .collect()
    })
}

/// The ownership-index section that records a file's kit hooks for `event`.
pub(crate) fn hooks_section_id(event: &str) -> String {
    format!("hooks.{event}")
}

/// A file counts as created by the kit if the first merge into it created it.
/// Every later section in that file inherits the flag, so whichever section
/// is stripped last can remove the file once it is empty.
fn keep_created(
    sections: Option<&std::collections::BTreeMap<String, Section>>,
    id: &str,
    absent: bool,
) -> bool {
    // Whatever the index said before, a file absent now is created by this merge.
    if absent {
        return true;
    }
    match sections.and_then(|s| s.get(id)) {
        Some(prior) => prior.file_created,
        None => match sections.filter(|s| !s.is_empty()) {
            Some(others) => others.values().any(|s| s.file_created),
            None => absent,
        },
    }
}

fn write_if_changed(current: &Option<Vec<u8>>, new: String, mode: Option<u32>) -> Action {
    if current.as_deref() == Some(new.as_bytes()) {
        Action::Unchanged
    } else {
        Action::Write {
            bytes: new.into_bytes(),
            mode,
        }
    }
}

/// After a strip, a file the kit created and that is now empty is removed.
fn strip_action(current: &Option<Vec<u8>>, stripped: String, sec: &Section, empty: &str) -> Action {
    if sec.file_created && (stripped.is_empty() || stripped == empty) {
        Action::Remove
    } else {
        write_if_changed(current, stripped, None)
    }
}

fn merge_err(path: &RelPath, e: crate::merge::MergeError) -> ExecError {
    ExecError::Merge(path.to_string(), e.to_string())
}
