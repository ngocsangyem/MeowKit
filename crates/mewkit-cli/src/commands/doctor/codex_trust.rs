//! Whether Codex trusts this project (`[projects."<path>"] trust_level` in
//! `$CODEX_HOME/config.toml`, default `~/.codex`). Read only: doctor never
//! marks anything trusted.
use std::path::{Path, PathBuf};

use super::{Check, Status};

/// Codex ignores project hooks until the user trusts the project.
pub fn check(root: &Path) -> Check {
    let home = std::env::var_os("CODEX_HOME")
        .map(PathBuf::from)
        .or_else(|| {
            ["HOME", "USERPROFILE"]
                .iter()
                .find_map(|v| std::env::var_os(v).filter(|h| !h.is_empty()))
                .map(|h| PathBuf::from(h).join(".codex"))
        });
    let trusted = home
        .and_then(|h| std::fs::read_to_string(h.join("config.toml")).ok())
        .and_then(|t| t.parse::<toml_edit::DocumentMut>().ok())
        .is_some_and(|doc| {
            // As given and canonical; Windows canonical paths lose `\\?\`.
            let canonical = root.canonicalize().ok();
            let keys =
                std::iter::once(root.to_string_lossy().into_owned()).chain(canonical.map(|c| {
                    let c = c.to_string_lossy().into_owned();
                    c.strip_prefix(r"\\?\").map_or(c.clone(), str::to_owned)
                }));
            let projects = doc.get("projects");
            keys.into_iter().any(|k| {
                projects
                    .and_then(|p| p.get(&k))
                    .and_then(|p| p.get("trust_level"))
                    .and_then(|v| v.as_str())
                    == Some("trusted")
            })
        });
    let hooks_note = "Codex also asks to trust each hook (/hooks); that state is not readable here";
    if trusted {
        Check::new(
            "codex trust",
            Status::Ok,
            format!("project trusted. {hooks_note}"),
        )
    } else {
        Check::new(
            "codex trust",
            Status::Warn,
            format!(
                "Codex does not list this project as trusted, so it ignores the project's hooks until you trust it in Codex. {hooks_note}"
            ),
        )
    }
}
