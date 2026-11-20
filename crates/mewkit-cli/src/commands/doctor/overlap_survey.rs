//! What one installed runtime loads from more than one root: the surface
//! table's roots for it, read against the ownership indexes and the disk.
use std::collections::{BTreeMap, BTreeSet};

use mewkit_adapters::contract::Runtime;
use mewkit_adapters::surface_table::{Kind, Pick, Read, SwitchScope, table};

use super::coexistence::{at, installed};
use super::coexistence_scan as scan;
use super::host_config::config_text;
use crate::place::Place;

/// The prefix a projected skill or agent carries (`projection/target.rs`);
/// Claude Code's own tree has the bare name.
const KIT_PREFIX: &str = "mk-";

/// What every install at one place recorded.
pub struct Owned {
    paths: BTreeSet<String>,
    /// Files an install merged hook registrations into.
    hook_files: BTreeSet<String>,
}

impl Owned {
    pub fn at(place: &Place) -> Self {
        let mut owned = Owned {
            paths: BTreeSet::new(),
            hook_files: BTreeSet::new(),
        };
        for index in Runtime::ALL.iter().filter_map(|r| installed(place, *r)) {
            owned.paths.extend(index.paths.keys().cloned());
            for (file, sections) in &index.sections {
                if sections.keys().any(|id| id.starts_with("hooks.")) {
                    owned.hook_files.insert(file.clone());
                }
            }
        }
        owned
    }

    /// `rel` is a recorded file, or a directory holding one.
    fn has(&self, rel: &str) -> bool {
        let inside = format!("{rel}/");
        self.paths.contains(rel)
            || self
                .paths
                .range(inside.clone()..)
                .next()
                .is_some_and(|p| p.starts_with(&inside))
    }
}

/// One entry under a root a runtime reads.
struct Seen {
    root: usize,
    /// The name a host shows: a skill's folder, an agent's file stem.
    name: String,
    /// The name on disk.
    file: String,
    owned: bool,
}

#[derive(Default)]
pub struct Found {
    /// Kit content loaded from a second root, as the row prints it.
    pub doubles: Vec<String>,
    /// The same, where the vendor does not settle that the root is read.
    pub maybe: Vec<String>,
    /// Unrecorded copies of kit entries, by path.
    pub strays: Vec<String>,
    /// Entries that are not the kit's under one name in two roots.
    pub same_name: Vec<String>,
    pub truncated: bool,
}

/// A project file that stops `read` and is in effect. The table names it as
/// `` `file` `key: [value]` ``; anything else is taken as not switched off.
fn switched_off(place: &Place, read: &Read) -> bool {
    let Some(switch) = read
        .switch
        .as_ref()
        .filter(|s| s.scope == SwitchScope::Project)
    else {
        return false;
    };
    let mut quoted = switch.set.split('`').skip(1).step_by(2);
    let (Some(file), Some(setting)) = (quoted.next(), quoted.next()) else {
        return false;
    };
    let Some((key, value)) = setting.split_once(':') else {
        return false;
    };
    let value = value.trim().trim_matches(['[', ']']);
    let Some(text) = config_text(&at(place, file)).text() else {
        return false;
    };
    // The list on the key's own line, or as `- item` lines under it.
    let mut lines = text
        .lines()
        .skip_while(|l| !l.trim_start().starts_with(key));
    let Some(first) = lines.next() else {
        return false;
    };
    let listed = |line: &str| {
        line.split(|c: char| !(c.is_alphanumeric() || c == '-' || c == '_'))
            .any(|word| word == value)
    };
    listed(first.trim_start().trim_start_matches(key))
        || lines
            .take_while(|l| l.trim_start().starts_with('-'))
            .any(listed)
}

/// A root that is itself a link shows another root's entries under a second
/// path: they are that root's, already counted there.
fn is_link(place: &Place, root: &str) -> bool {
    std::fs::symlink_metadata(at(place, root)).is_ok_and(|m| m.file_type().is_symlink())
}

/// How a second root is named in a row, with the setting that stops the read.
fn second(read: &Read, what: &str) -> String {
    let off = read
        .switch
        .as_ref()
        .filter(|s| s.scope == SwitchScope::User)
        .map(|s| format!(" ({} stops it)", s.set))
        .unwrap_or_default();
    format!("{what} also from {}{off}", read.root)
}

pub fn survey(place: &Place, runtime: Runtime, owned: &Owned) -> Found {
    let mut found = Found::default();
    for kind in [Kind::Skills, Kind::Agents, Kind::Hooks] {
        let Some(surface) = table().surface(runtime, kind) else {
            continue;
        };
        // One copy loads under a precedence, whatever else is on disk.
        if surface.pick == Pick::First {
            continue;
        }
        let roots: Vec<&Read> = surface
            .roots
            .iter()
            .filter(|read| !switched_off(place, read))
            .collect();
        if kind == Kind::Hooks {
            let holds =
                |read: &&Read| owned.has(&read.root) || owned.hook_files.contains(&read.root);
            let mut with_kit = roots.iter().copied().filter(holds);
            let first = with_kit.next();
            for read in with_kit {
                let unsure = read.unsure.is_some() || first.is_some_and(|f| f.unsure.is_some());
                let line = second(read, "hooks");
                if unsure {
                    found.maybe.push(line);
                } else {
                    found.doubles.push(line);
                }
            }
            continue;
        }
        let mut seen: Vec<Seen> = Vec::new();
        for (i, read) in roots.iter().enumerate() {
            if is_link(place, &read.root) {
                continue;
            }
            let dir = at(place, &read.root);
            let listing = if kind == Kind::Skills {
                scan::dirs(&dir)
            } else {
                scan::files(&dir)
            };
            found.truncated |= listing.truncated;
            for entry in &listing.entries {
                let file = entry.file_name();
                // An agent definition is Markdown or, for Codex, TOML; a
                // backup beside one is not loaded.
                let definition = [".md", ".toml"].iter().any(|ext| file.ends_with(ext));
                if kind == Kind::Agents && !definition {
                    continue;
                }
                seen.push(Seen {
                    root: i,
                    owned: owned.has(&format!("{}/{file}", read.root)),
                    name: entry.name.clone(),
                    file,
                });
            }
        }
        // A kit entry is one item whichever tree's naming it carries.
        let item = |name: &str| name.strip_prefix(KIT_PREFIX).unwrap_or(name).to_owned();
        let mut kit: BTreeMap<String, Vec<usize>> = BTreeMap::new();
        let mut kit_names: BTreeSet<&str> = BTreeSet::new();
        for s in seen.iter().filter(|s| s.owned) {
            kit.entry(item(&s.name)).or_default().push(s.root);
            kit_names.insert(&s.name);
        }
        // Per second root: how many kit items load from it again, surely and maybe.
        let mut again: BTreeMap<usize, (usize, usize)> = BTreeMap::new();
        for held in kit.values_mut() {
            held.dedup();
            let first = held[0];
            for &root in &held[1..] {
                let counts = again.entry(root).or_default();
                if roots[root].unsure.is_some() || roots[first].unsure.is_some() {
                    counts.1 += 1;
                } else {
                    counts.0 += 1;
                }
            }
        }
        for (root, (sure, maybe)) in again {
            let line = |count: usize| second(roots[root], &format!("{count} {}", kind.name()));
            if sure > 0 {
                found.doubles.push(line(sure));
            }
            if maybe > 0 {
                found.maybe.push(line(maybe));
            }
        }
        let mut others: BTreeMap<&str, usize> = BTreeMap::new();
        for s in seen.iter().filter(|s| !s.owned) {
            let path = format!("{}/{}", roots[s.root].root, s.file);
            if s.name.starts_with(KIT_PREFIX) && kit.contains_key(&item(&s.name)) {
                found.strays.push(path);
            } else if kit_names.contains(s.name.as_str()) {
                found.same_name.push(path);
            } else {
                *others.entry(&s.name).or_default() += 1;
            }
        }
        found.same_name.extend(
            others
                .into_iter()
                .filter(|(_, count)| *count > 1)
                .map(|(name, _)| format!("{name} ({})", kind.name())),
        );
    }
    found
}

#[cfg(test)]
mod tests {
    use super::*;

    /// OMP's read of `.claude/skills`, which `.omp/config.yml` can switch off.
    fn claude_import() -> &'static Read {
        let surface = table().surface(Runtime::Omp, Kind::Skills).expect("omp");
        surface
            .roots
            .iter()
            .find(|read| read.root == ".claude/skills")
            .expect("the import")
    }

    #[test]
    fn a_project_switch_counts_in_either_list_form_and_only_for_its_own_value() {
        let dir = tempfile::tempdir().expect("a temporary directory");
        let place = Place::project(dir.path());
        let config = dir.path().join(".omp/config.yml");
        std::fs::create_dir_all(config.parent().expect("a parent")).expect("create");
        assert!(!switched_off(&place, claude_import()), "no config file");
        for (text, off) in [
            ("disabledProviders: [claude]\n", true),
            ("theme: dark\ndisabledProviders: [codex, claude]\n", true),
            (
                "disabledProviders:\n  - codex\n  - claude\nother:\n  - x\n",
                true,
            ),
            ("disabledProviders: [codex]\n", false),
            ("disabledProviders: [claudette]\n", false),
            ("disabledProviders:\n  - codex\nother:\n  - claude\n", false),
        ] {
            std::fs::write(&config, text).expect("write");
            assert_eq!(switched_off(&place, claude_import()), off, "{text}");
        }
    }
}
