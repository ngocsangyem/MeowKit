//! Removal planned from the ownership index, shared by every emitter.
//!
//! Only what the index records is touched: owned files are removed (the
//! executor still refuses edited ones), and in shared files only the kit's
//! blocks, entries and hook handlers are taken out.
use crate::contract::{EmitError, Format, Op, OwnershipIndex, Plan, RelPath};
use crate::kit_files::rel;
use mewkit_core::plan::HookLayout;

/// `hook_layout` names the files whose `hooks.<event>` sections hold hook
/// handlers (merged with `MergeHooks`) rather than named entries, and how.
pub fn plan_from_index(
    roots: &[RelPath],
    owned: &OwnershipIndex,
    hook_layout: impl Fn(&str) -> Option<HookLayout>,
) -> Result<Plan, EmitError> {
    let within = |p: &RelPath| {
        roots
            .iter()
            .any(|r| p == r || p.as_str().starts_with(&format!("{}/", r.as_str())))
    };
    let mut ops = Vec::new();
    for path in owned.paths.keys() {
        let path = rel(path)?;
        if within(&path) {
            ops.push(Op::RemoveFile { path });
        }
    }
    for (file, sections) in &owned.sections {
        let path = rel(file)?;
        if !within(&path) {
            continue;
        }
        for (id, sec) in sections {
            let layout = hook_layout(file).filter(|_| sec.key.len() == 2 && sec.key[0] == "hooks");
            ops.push(match sec.format {
                Format::Markdown => Op::StripBlock {
                    path: path.clone(),
                    id: id.clone(),
                },
                Format::Json if let Some(layout) = layout => Op::StripHooks {
                    path: path.clone(),
                    event: sec.key[1].clone(),
                    ids: sec.names.clone(),
                    layout,
                },
                format => Op::StripEntries {
                    path: path.clone(),
                    format,
                    key: sec.key.clone(),
                    names: sec.names.clone(),
                },
            });
        }
    }
    Ok(Plan {
        ops,
        ..Plan::default()
    })
}
