//! The Cursor bundle's MCP profile catalog and the merge into `.cursor/mcp.json`.
//!
//! MCP is deny-by-default: a fresh install carries no MCP config, and a profile
//! takes effect only when it is named. Applying one merges server entries into
//! a file the user may own outright, so a server the user already has is never
//! replaced (a different definition under the same name is reported), and a
//! profile whose values could carry a literal secret is refused before
//! anything is written. Port of `cursor-mcp-profile-catalog.ts`,
//! `cursor-mcp-profile-lint.ts` and the merge half of `cursor-mcp-profiles.ts`.
use std::path::Path;
use std::sync::LazyLock;

use regex::Regex;
use serde_json::{Map, Value};

/// Where the catalog sits inside the Cursor bundle.
pub const CATALOG_REL: &str = "catalog/mcp-profiles.json";
/// Cursor's documented interpolation variables besides `${env:NAME}`.
const STATIC_VARS: [&str; 4] = [
    "workspaceFolder",
    "workspaceFolderBasename",
    "userHome",
    "pathSeparator",
];

#[derive(Clone, Debug)]
pub struct Profile {
    pub description: String,
    pub servers: Map<String, Value>,
}

/// Profiles in the order the catalog lists them.
#[derive(Clone, Debug, Default)]
pub struct Catalog {
    pub profiles: Vec<(String, Profile)>,
}

/// Which profiles were asked for.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Selection {
    All,
    Names(Vec<String>),
}

impl Selection {
    /// `all`, a comma list, or empty (which selects nothing). Unlike skill
    /// packs there is no default: an absent flag never turns MCP on.
    pub fn parse(raw: &str) -> Self {
        let v = raw.trim();
        if v.eq_ignore_ascii_case("all") {
            return Self::All;
        }
        Self::Names(
            v.split(',')
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_owned)
                .collect(),
        )
    }

    pub fn is_empty(&self) -> bool {
        matches!(self, Self::Names(n) if n.is_empty())
    }
}

/// The catalog under `bundle_dir`, or `None` when the bundle ships none.
pub fn load(bundle_dir: &Path) -> Result<Option<Catalog>, String> {
    let file = bundle_dir.join(CATALOG_REL);
    if !file.is_file() {
        return Ok(None);
    }
    let bad = |why: String| format!("invalid mcp-profiles.json: {why}");
    let text = std::fs::read_to_string(&file).map_err(|e| bad(e.to_string()))?;
    let doc: Value = serde_json::from_str(&text).map_err(|e| bad(e.to_string()))?;
    let profiles = doc
        .get("profiles")
        .and_then(Value::as_object)
        .ok_or_else(|| bad("profiles: expected object".into()))?;
    let mut out = Vec::new();
    for (name, p) in profiles {
        if !matches!(p["transport"].as_str(), Some("stdio" | "remote")) {
            return Err(bad(format!(
                "profiles.{name}.transport: invalid enum value"
            )));
        }
        let servers = p["mcpServers"]
            .as_object()
            .filter(|s| s.values().all(Value::is_object))
            .ok_or_else(|| {
                bad(format!(
                    "profiles.{name}.mcpServers: expected object of objects"
                ))
            })?;
        out.push((
            name.clone(),
            Profile {
                description: p["description"].as_str().unwrap_or_default().to_owned(),
                servers: servers.clone(),
            },
        ));
    }
    Ok(Some(Catalog { profiles: out }))
}

impl Catalog {
    /// The selected profiles; a name that is not in the catalog is an error,
    /// so a typo cannot silently apply nothing.
    pub fn resolve(&self, selection: &Selection) -> Result<Vec<(&str, &Profile)>, String> {
        let pick = |name: &str| {
            self.profiles
                .iter()
                .find(|(n, _)| n == name)
                .map(|(n, p)| (n.as_str(), p))
                .ok_or_else(|| {
                    let mut known: Vec<&str> =
                        self.profiles.iter().map(|(n, _)| n.as_str()).collect();
                    known.sort_unstable();
                    format!(
                        "unknown MCP profile \"{name}\" (known: {})",
                        if known.is_empty() {
                            "(none shipped)".into()
                        } else {
                            known.join(", ")
                        }
                    )
                })
        };
        match selection {
            Selection::All => Ok(self.profiles.iter().map(|(n, p)| (n.as_str(), p)).collect()),
            Selection::Names(names) => names.iter().map(|n| pick(n)).collect(),
        }
    }
}

static ENV_TOKEN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^\$\{env:[A-Z0-9_]+\}$").unwrap());
static ANY_TOKEN: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\$\{[^}]*\}").unwrap());
static DOCUMENTED: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(&format!(
        r"^\$\{{(?:env:[A-Z0-9_]+|{})\}}$",
        STATIC_VARS.join("|")
    ))
    .unwrap()
});
// A heuristic for an obvious literal secret in a non-`env` field. Defense in
// depth, not a secret scanner.
static SECRET_LIKE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"(sk-[a-zA-Z0-9]{10,}|ghp_[a-zA-Z0-9]{20,}|xox[baprs]-[a-zA-Z0-9-]{10,}|AKIA[0-9A-Z]{12,}|[A-Za-z0-9+/]{32,}={0,2})",
    )
    .unwrap()
});

/// Why a profile is not safe to write, empty when clean. `env` values must be
/// a whole `${env:NAME}` reference, since that is where a pasted secret most
/// likely lands; every other string may use only documented tokens and must
/// not look like a literal secret.
pub fn lint(name: &str, profile: &Profile) -> Vec<String> {
    let mut issues = Vec::new();
    for (server, def) in &profile.servers {
        for (key, value) in def["env"].as_object().into_iter().flatten() {
            let v = value.as_str().unwrap_or_default();
            if !ENV_TOKEN.is_match(v) {
                issues.push(format!(
                    "{name}/{server}.env.{key}: must be a whole \"${{env:NAME}}\" reference, got \"{v}\""
                ));
            }
        }
        let mut fields: Vec<(String, &str)> = Vec::new();
        for f in ["command", "url"] {
            if let Some(s) = def[f].as_str() {
                fields.push((f.to_owned(), s));
            }
        }
        for (i, a) in def["args"].as_array().into_iter().flatten().enumerate() {
            if let Some(s) = a.as_str() {
                fields.push((format!("args[{i}]"), s));
            }
        }
        for (k, v) in def["headers"].as_object().into_iter().flatten() {
            if let Some(s) = v.as_str() {
                fields.push((format!("headers.{k}"), s));
            }
        }
        for (field, raw) in fields {
            for token in ANY_TOKEN.find_iter(raw) {
                if !DOCUMENTED.is_match(token.as_str()) {
                    issues.push(format!(
                        "{name}/{server}.{field}: undocumented interpolation token \"{}\"",
                        token.as_str()
                    ));
                }
            }
            if SECRET_LIKE.is_match(&ANY_TOKEN.replace_all(raw, "")) {
                issues.push(format!(
                    "{name}/{server}.{field}: value looks like a literal secret"
                ));
            }
        }
    }
    issues
}

/// What applying the profiles to the existing `mcp.json` text adds.
#[derive(Debug, Default)]
pub struct Merge {
    /// Server entries to merge in.
    pub added: Map<String, Value>,
    /// Servers already present with a different definition: left as they are.
    pub conflicts: Vec<String>,
}

pub fn plan_merge(existing: Option<&str>, profiles: &[(&str, &Profile)]) -> Result<Merge, String> {
    let doc: Value = match existing.filter(|t| !t.trim().is_empty()) {
        Some(t) => serde_json::from_str(t).map_err(|e| e.to_string())?,
        None => Value::Object(Map::new()),
    };
    let have = doc.get("mcpServers").and_then(Value::as_object);
    let mut out = Merge::default();
    for (_, profile) in profiles {
        for (server, def) in &profile.servers {
            match have.and_then(|h| h.get(server)) {
                None => {
                    out.added.insert(server.clone(), def.clone());
                }
                Some(current) if current != def && !out.conflicts.contains(server) => {
                    out.conflicts.push(server.clone());
                }
                Some(_) => {}
            }
        }
    }
    Ok(out)
}

#[cfg(test)]
#[path = "mcp_profiles_tests.rs"]
mod tests;
