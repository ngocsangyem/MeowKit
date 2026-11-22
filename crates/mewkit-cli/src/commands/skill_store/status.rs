//! `skill status`: index what is installed and list every skill with its
//! owner, digests and drift. Writes the sidecar, never a skill file.
use mewkit_core::skill_store::{Observed, SkillRecord};
use serde_json::{Value, json};

use super::{open, short};
use crate::failure::{Failure, OK};
use crate::place::Place;

pub fn run(place: &Place, json_out: bool) -> Result<u8, Failure> {
    let store = open(place)?;
    let (next, survey) = store.index(&store.checked())?;
    store.save(&next, &survey)?;
    let pending = store.overlays.pending(&store.approvals);
    let rows: Vec<(&String, &SkillRecord, Vec<String>)> = next
        .records
        .iter()
        .map(|(key, record)| {
            let mut lines = notes(record, survey.get(key));
            lines.extend(overlay_notes(record, survey.get(key)));
            if pending.contains(key) {
                lines.push(format!(
                    "an overlay is stored but not approved on this machine; \
                     `mewkit skill overlay {} --approve` shows it (waiting for approval)",
                    record.name
                ));
            }
            (key, record, lines)
        })
        .collect();
    if json_out {
        let skills: Vec<Value> = rows
            .iter()
            .map(|(key, r, notes)| {
                json!({
                    "skill": key,
                    "name": r.name,
                    "status": status_of(r),
                    "state": r.state.label(),
                    "unverified": r.unverified,
                    "digest": r.digest,
                    "base": r.base,
                    "owners": r.owners,
                    "history": r.history,
                    "forkOf": r.fork_of,
                    "drift": notes,
                })
            })
            .collect();
        let doc = json!({"scope": store.label, "skills": skills});
        println!("{}", serde_json::to_string_pretty(&doc).unwrap_or_default());
        return Ok(OK);
    }
    if rows.is_empty() {
        println!("no skills recorded here ({})", store.label);
        return Ok(OK);
    }
    println!(
        "skills ({}): {} recorded in {}",
        store.label,
        rows.len(),
        store.paths.sidecar
    );
    let width = rows.iter().map(|(k, _, _)| k.len()).max().unwrap_or(0);
    for (key, r, notes) in &rows {
        let base = match r.base.as_deref() {
            Some(b) if b != r.digest => format!("  base {}", short(b)),
            _ => String::new(),
        };
        println!(
            "  {key:<width$}  {:<10}  {}{base}",
            status_of(r),
            short(&r.digest)
        );
        for note in notes {
            println!("  {:<width$}    {note}", "");
        }
    }
    Ok(OK)
}

/// What the user is told a skill is: `unverified` overrides the owner.
fn status_of(r: &SkillRecord) -> &'static str {
    if r.unverified {
        "unverified"
    } else {
        r.state.label()
    }
}

/// How the skill has drifted from its record, one line each.
fn notes(r: &SkillRecord, seen: Option<&Observed>) -> Vec<String> {
    let mut out = Vec::new();
    if r.unverified {
        out.push(
            "the ownership ledger changed without the skill store (another mewkit ran); \
             kept as it is. `mewkit skill rollback` restores a recorded tree"
                .to_owned(),
        );
    }
    if let Some(seen) = seen {
        let edited: Vec<&str> = seen
            .edited
            .iter()
            .filter(|p| !r.overlay.contains_key(*p))
            .map(String::as_str)
            .collect();
        if !edited.is_empty() {
            out.push(format!("edited since install: {}", edited.join(", ")));
        }
        if !seen.missing.is_empty() {
            out.push(format!("missing: {}", seen.missing.join(", ")));
        }
    }
    out
}

/// Drift of an overlaid skill: upstream changed a file since the overlay, or
/// the file was edited in place after the overlay was stored.
fn overlay_notes(r: &SkillRecord, seen: Option<&Observed>) -> Vec<String> {
    let mut out = Vec::new();
    for (path, file) in &r.overlay {
        if file.upstream != file.base {
            out.push(format!("upstream changed {path} since the overlay"));
        }
        let on_disk = seen.and_then(|s| s.files.iter().find(|f| f.path == *path));
        if on_disk.is_some_and(|f| f.sha256 != file.projected) {
            out.push(format!(
                "{path} was edited after the overlay was stored, so the stored overlay is out \
                 of date; the file is kept as it is (`mewkit skill overlay {}` stores it)",
                r.name
            ));
        }
    }
    out
}
