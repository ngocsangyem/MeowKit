//! Which project paths each runtime loads, by kind of kit content.
//!
//! The data is `surface_table.json`; every root in it carries the vendor page,
//! source file or probe row it was taken from. Nothing here decides where the
//! kit writes: `placement_resolver` computes that from this table.
use std::collections::BTreeMap;
use std::sync::LazyLock;

use serde::Deserialize;

use crate::contract::Runtime;

const DATA: &str = include_str!("surface_table.json");

static TABLE: LazyLock<SurfaceTable> =
    LazyLock::new(|| SurfaceTable::parse(DATA).expect("surface_table.json is valid"));

/// The table built into this binary.
pub fn table() -> &'static SurfaceTable {
    &TABLE
}

/// A kind of kit content a runtime discovers on its own.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Kind {
    Skills,
    Agents,
    /// Instructions read in every session: context files and rule folders.
    AlwaysOn,
    Hooks,
    Mcp,
}

impl Kind {
    pub const ALL: [Kind; 5] = [
        Kind::Skills,
        Kind::Agents,
        Kind::AlwaysOn,
        Kind::Hooks,
        Kind::Mcp,
    ];

    pub fn name(self) -> &'static str {
        match self {
            Kind::Skills => "skills",
            Kind::Agents => "agents",
            Kind::AlwaysOn => "always-on",
            Kind::Hooks => "hooks",
            Kind::Mcp => "mcp",
        }
    }
}

/// How a runtime treats the same item found under several of its roots.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Pick {
    /// Every copy is loaded.
    #[default]
    All,
    /// An item found under several roots loads from the one listed first.
    First,
}

/// Who can stop a runtime reading a root.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SwitchScope {
    /// A file inside the project, which an install can write.
    Project,
    /// A user setting or environment variable, out of an install's reach.
    User,
}

#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Switch {
    pub scope: SwitchScope,
    /// The setting and the value that turns the read off.
    pub set: String,
}

/// One root a runtime reads for one kind.
#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Read {
    pub root: String,
    /// The kit may put this runtime's copy here.
    #[serde(default)]
    pub write: bool,
    /// Why it is not settled that the runtime reads this root: the vendor
    /// names no path, or the read depends on the project.
    #[serde(default)]
    pub unsure: Option<String>,
    #[serde(default)]
    pub switch: Option<Switch>,
    /// Vendor page, source file with version, or probe row.
    pub source: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct KindSurface {
    #[serde(default)]
    pub pick: Pick,
    /// The runtime's precedence where `pick` is first; otherwise the order in
    /// which the kit prefers to write.
    pub roots: Vec<Read>,
    #[serde(default)]
    pub note: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RuntimeSurface {
    /// The `--target` name.
    pub name: String,
    /// The version or documentation date the rows were checked against.
    pub checked: String,
    pub kinds: BTreeMap<Kind, KindSurface>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SurfaceTable {
    pub collected: String,
    /// Roots no single runtime owns; their text is written for whoever reads them.
    pub neutral_roots: Vec<String>,
    pub runtimes: Vec<RuntimeSurface>,
}

impl SurfaceTable {
    pub fn parse(json: &str) -> Result<Self, String> {
        let table: SurfaceTable = serde_json::from_str(json).map_err(|e| e.to_string())?;
        table.check()?;
        Ok(table)
    }

    fn check(&self) -> Result<(), String> {
        let named: Vec<Runtime> = self
            .runtimes
            .iter()
            .map(|r| Runtime::from_name(&r.name).ok_or(format!("unknown runtime {}", r.name)))
            .collect::<Result<_, _>>()?;
        if named != Runtime::ALL {
            return Err("runtimes must list every runtime once, in `Runtime::ALL` order".into());
        }
        for runtime in &self.runtimes {
            for (kind, surface) in &runtime.kinds {
                let at = format!("{} {}", runtime.name, kind.name());
                let roots = &surface.roots;
                if !roots.is_empty() && !roots.iter().any(|r| r.write) {
                    return Err(format!("{at}: no root the kit may write"));
                }
                if surface.pick == Pick::First && roots.iter().any(|r| r.unsure.is_some()) {
                    return Err(format!("{at}: an unsure root has no place in a precedence"));
                }
                for (i, read) in surface.roots.iter().enumerate() {
                    if read.source.trim().is_empty() {
                        return Err(format!("{at}: {} has no source", read.root));
                    }
                    if read.write && read.unsure.is_some() {
                        return Err(format!("{at}: {} is written yet unsure", read.root));
                    }
                    if surface.roots[..i].iter().any(|r| r.root == read.root) {
                        return Err(format!("{at}: {} is listed twice", read.root));
                    }
                }
            }
        }
        for kind in Kind::ALL {
            let mut homes: BTreeMap<&str, &str> = BTreeMap::new();
            for (runtime, read) in self.writers(kind) {
                if self.is_neutral(&read.root) {
                    continue;
                }
                if let Some(other) = homes.insert(&read.root, &runtime.name) {
                    return Err(format!(
                        "{}: {} is written by {other} and {}; list it as neutral",
                        kind.name(),
                        read.root,
                        runtime.name
                    ));
                }
            }
        }
        Ok(())
    }

    fn writers(&self, kind: Kind) -> impl Iterator<Item = (&RuntimeSurface, &Read)> {
        self.runtimes.iter().flat_map(move |runtime| {
            let roots = runtime.kinds.get(&kind).map(|k| k.roots.as_slice());
            roots
                .unwrap_or_default()
                .iter()
                .filter(|read| read.write)
                .map(move |read| (runtime, read))
        })
    }

    pub fn is_neutral(&self, root: &str) -> bool {
        self.neutral_roots.iter().any(|r| r == root)
    }

    /// What `runtime` reads for `kind`; `None` when it has no such content.
    pub fn surface(&self, runtime: Runtime, kind: Kind) -> Option<&KindSurface> {
        let row = self.runtimes.iter().find(|r| r.name == runtime.name())?;
        row.kinds.get(&kind).filter(|k| !k.roots.is_empty())
    }

    /// The runtime whose own folder `root` is, for `kind`; `None` for a neutral root.
    pub fn home(&self, kind: Kind, root: &str) -> Option<Runtime> {
        if self.is_neutral(root) {
            return None;
        }
        self.writers(kind)
            .find(|(_, read)| read.root == root)
            .and_then(|(runtime, _)| Runtime::from_name(&runtime.name))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_built_in_table_parses_and_every_runtime_has_a_skill_root() {
        let table = table();
        for runtime in Runtime::ALL {
            assert!(
                table.surface(runtime, Kind::Skills).is_some(),
                "{} has no skill root",
                runtime.name()
            );
        }
    }

    #[test]
    fn a_root_without_a_source_is_refused() {
        let mut json: serde_json::Value = serde_json::from_str(DATA).unwrap();
        json["runtimes"][0]["kinds"]["skills"]["roots"][0]["source"] = " ".into();
        let err = SurfaceTable::parse(&json.to_string()).unwrap_err();
        assert_eq!(err, "claude-code skills: .claude/skills has no source");
    }

    #[test]
    fn a_kind_nothing_may_write_and_an_unsure_precedence_are_refused() {
        let mut json: serde_json::Value = serde_json::from_str(DATA).unwrap();
        json["runtimes"][0]["kinds"]["skills"]["roots"][0]["write"] = false.into();
        let err = SurfaceTable::parse(&json.to_string()).unwrap_err();
        assert_eq!(err, "claude-code skills: no root the kit may write");

        let mut json: serde_json::Value = serde_json::from_str(DATA).unwrap();
        json["runtimes"][0]["kinds"]["always-on"]["pick"] = "first".into();
        let err = SurfaceTable::parse(&json.to_string()).unwrap_err();
        assert_eq!(
            err,
            "claude-code always-on: an unsure root has no place in a precedence"
        );
    }

    #[test]
    fn a_runtime_folder_has_one_home() {
        let table = table();
        assert_eq!(
            table.home(Kind::Skills, ".claude/skills"),
            Some(Runtime::ClaudeCode)
        );
        assert_eq!(table.home(Kind::Skills, ".agents/skills"), None);
    }
}
