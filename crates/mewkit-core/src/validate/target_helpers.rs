//! The pieces the target checks share: rows, TOML, wrappers, references.
use std::path::{Path, PathBuf};
use std::sync::LazyLock;

use regex::Regex;
use serde_json::Value;

use super::result::{CheckResult, Section, Status};
use super::toml_json::table_to_json;

pub fn row(name: &str, status: Status, detail: String) -> CheckResult {
    CheckResult::new(name, status, detail, Section::Target)
}

/// A secret-name heuristic over the key NAME only — values are never available
/// to the emitter this mirrors, and are not consulted here either.
pub fn is_secret_like_key(key: &str) -> bool {
    static PATTERN: LazyLock<Regex> = LazyLock::new(|| {
        crate::js_regex::compile_ci("(SECRET|TOKEN|PASSWORD|PASS|API_KEY|KEY|CREDENTIAL)")
            .expect("a static secret-name pattern")
    });
    PATTERN.is_match(key)
}

/// Parse a TOML document into JSON, so one shape serves every reader here.
///
/// `toml_edit` is the workspace's TOML reader (the Codex emitter writes with
/// it), and it is a format-preserving editor rather than a deserializer — hence
/// the small conversion below instead of a serde round-trip, and no new
/// dependency.
pub fn parse_toml(path: &Path) -> Result<Value, String> {
    let text = std::fs::read(path)
        .map(|bytes| String::from_utf8_lossy(&bytes).into_owned())
        .map_err(|error| error.to_string())?;
    let document: toml_edit::DocumentMut =
        text.parse().map_err(|error: toml_edit::TomlError| {
            // The message is the parser's own, as the npm CLI prints its parser's.
            error.to_string()
        })?;
    Ok(table_to_json(document.as_table()))
}

/// Files in `dir` with the given extension, in Node's order.
pub fn list_files(dir: &Path, ext: &str) -> Vec<PathBuf> {
    super::dir_order::sorted_names(dir)
        .into_iter()
        .filter(|name| name.ends_with(ext))
        .map(|name| dir.join(name))
        .collect()
}

/// `X_OK` for owner, group or other.
///
/// Windows has no POSIX execute bit, and the bit is not what makes a wrapper
/// runnable there — `hooks.json` invokes each as `node <path>`, which needs
/// read access. So on Windows existence is the real contract.
#[cfg(unix)]
pub(super) fn is_executable(file: &Path) -> bool {
    use std::os::unix::fs::PermissionsExt;
    std::fs::metadata(file).is_ok_and(|meta| meta.permissions().mode() & 0o111 != 0)
}

#[cfg(not(unix))]
pub(super) fn is_executable(file: &Path) -> bool {
    file.exists()
}

static OPERATIONAL_REF: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile(r"\.codex/(?:hooks|scripts)/[\w.-]+")
        .expect("a static operational-ref pattern")
});

/// Bundle-internal OPERATIONAL paths named by the target's own files must
/// resolve. External CLIs and runtime paths are not bundle files and are
/// deliberately not checked.
pub fn reference_graph_rows(dir: &Path) -> Vec<CheckResult> {
    let mut sources = Vec::new();
    for rel in ["AGENTS.md", ".codex/hooks.json"] {
        let path = rel
            .split('/')
            .fold(dir.to_path_buf(), |acc, part| acc.join(part));
        if path.exists()
            && let Ok(bytes) = std::fs::read(&path)
        {
            sources.push(String::from_utf8_lossy(&bytes).into_owned());
        }
    }
    for file in list_files(&dir.join(".codex").join("agents"), ".toml") {
        if let Ok(bytes) = std::fs::read(&file) {
            sources.push(String::from_utf8_lossy(&bytes).into_owned());
        }
    }
    let mut refs: Vec<String> = Vec::new();
    for text in &sources {
        for found in OPERATIONAL_REF.find_iter(text) {
            let reference = found.as_str().to_string();
            if !refs.contains(&reference) {
                refs.push(reference);
            }
        }
    }
    if refs.is_empty() {
        return Vec::new();
    }
    let dangling: Vec<&String> = refs
        .iter()
        .filter(|reference| {
            !reference
                .split('/')
                .fold(dir.to_path_buf(), |acc, part| acc.join(part))
                .exists()
        })
        .collect();
    vec![if dangling.is_empty() {
        row(
            "Codex root reference graph",
            Status::Pass,
            format!("{} bundle-internal operational ref(s) resolve", refs.len()),
        )
    } else {
        row(
            "Codex root reference graph",
            Status::Fail,
            format!(
                "dangling reference(s): {}",
                dangling
                    .iter()
                    .map(|r| r.as_str())
                    .collect::<Vec<_>>()
                    .join(", ")
            ),
        )
    }]
}
