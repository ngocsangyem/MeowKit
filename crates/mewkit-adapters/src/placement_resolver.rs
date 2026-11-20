//! Where each kind of kit content is written for a set of runtimes sharing one
//! project, so that every runtime loads it once.
//!
//! Placement depends on the whole set: a runtime that also reads another
//! runtime's folder needs no copy of its own, and a second copy would load
//! twice. The resolver tries every combination of the roots the set may write
//! and keeps the one with the fewest duplicate loads. It reads only the surface
//! table and touches no file.
use std::collections::BTreeMap;

use crate::contract::Runtime;
use crate::surface_table::{Kind, KindSurface, Pick, Read, SurfaceTable, SwitchScope};

/// The wording a root's text is written in.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Dialect {
    /// One runtime's own names, paths and tool words.
    Host(Runtime),
    /// Wording every reader of the root can follow.
    Shared,
}

/// A root the kit writes for one kind.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Write {
    pub root: String,
    pub dialect: Dialect,
    /// The runtime whose emitter writes the root: the first in the set that may.
    pub owner: Runtime,
    /// Runtimes in the set that load this root.
    pub readers: Vec<Runtime>,
}

/// A written root a runtime loads on top of its source.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Extra {
    pub root: String,
    /// Why it is not settled that the runtime loads it; `None` when it does,
    /// and the content then loads twice.
    pub unsure: Option<String>,
    /// The user setting that stops the runtime reading it, where one exists.
    pub turn_off: Option<String>,
}

/// What one runtime ends up loading for one kind.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct View {
    /// The root its copy comes from.
    pub source: String,
    pub extras: Vec<Extra>,
    /// Project settings the install must write so a foreign root is not read.
    pub switches: Vec<String>,
    /// A user setting that would stop it reading `source`; it must stay on.
    pub depends_on: Option<String>,
}

impl View {
    /// Roots that certainly load a second copy.
    pub fn duplicates(&self) -> impl Iterator<Item = &Extra> {
        self.extras.iter().filter(|e| e.unsure.is_none())
    }
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct KindPlacement {
    pub writes: Vec<Write>,
    /// By runtime; a runtime with no such content has no entry.
    pub views: BTreeMap<Runtime, View>,
}

/// The placement for one set of runtimes.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Placement {
    pub set: Vec<Runtime>,
    pub kinds: BTreeMap<Kind, KindPlacement>,
}

impl Placement {
    /// The roots `runtime`'s emitter writes for `kind`.
    pub fn writes_of(&self, runtime: Runtime, kind: Kind) -> impl Iterator<Item = &Write> {
        let writes = self.kinds.get(&kind).map(|k| k.writes.as_slice());
        writes
            .unwrap_or_default()
            .iter()
            .filter(move |w| w.owner == runtime)
    }

    pub fn view(&self, runtime: Runtime, kind: Kind) -> Option<&View> {
        self.kinds.get(&kind)?.views.get(&runtime)
    }
}

/// Lower is better, compared field by field in this order.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, PartialOrd, Ord)]
struct Cost {
    duplicates: usize,
    /// Runtimes whose only copy is in another runtime's wording.
    foreign: usize,
    /// Copies a runtime may load as well; the vendor does not settle it.
    unsettled: usize,
    roots: usize,
    /// How far down its own list each runtime's source sits.
    rank: usize,
}

/// Place every kind for `set`. Duplicates and order in `set` do not matter.
pub fn resolve(table: &SurfaceTable, set: &[Runtime]) -> Placement {
    let set: Vec<Runtime> = Runtime::ALL
        .into_iter()
        .filter(|r| set.contains(r))
        .collect();
    let kinds = Kind::ALL
        .into_iter()
        .map(|kind| (kind, place(table, &set, kind)))
        .collect();
    Placement { set, kinds }
}

fn place(table: &SurfaceTable, set: &[Runtime], kind: Kind) -> KindPlacement {
    let surfaces: Vec<(Runtime, &KindSurface)> = set
        .iter()
        .filter_map(|&r| Some((r, table.surface(r, kind)?)))
        .collect();
    let mut candidates: Vec<&str> = Vec::new();
    for read in surfaces.iter().flat_map(|(_, s)| &s.roots) {
        if read.write && !candidates.contains(&read.root.as_str()) {
            candidates.push(&read.root);
        }
    }

    let mut best: Option<(Cost, KindPlacement)> = None;
    for mask in 1u32..(1 << candidates.len()) {
        let written: Vec<&str> = candidates
            .iter()
            .enumerate()
            .filter(|(i, _)| mask & (1 << i) != 0)
            .map(|(_, root)| *root)
            .collect();
        let Some((cost, views)) = views(table, kind, &surfaces, &written) else {
            continue;
        };
        if best.as_ref().is_none_or(|(least, _)| cost < *least) {
            let writes = written
                .iter()
                .filter_map(|root| write(table, kind, &surfaces, &views, root))
                .collect();
            best = Some((cost, KindPlacement { writes, views }));
        }
    }
    best.map(|(_, placement)| placement).unwrap_or_default()
}

/// What each runtime loads when `written` are the roots on disk; `None` when a
/// runtime would be left without a copy.
fn views(
    table: &SurfaceTable,
    kind: Kind,
    surfaces: &[(Runtime, &KindSurface)],
    written: &[&str],
) -> Option<(Cost, BTreeMap<Runtime, View>)> {
    let mut cost = Cost {
        roots: written.len(),
        ..Cost::default()
    };
    let mut out = BTreeMap::new();
    for &(runtime, surface) in surfaces {
        let mut loaded: Vec<(usize, &Read)> = surface
            .roots
            .iter()
            .enumerate()
            .filter(|(_, read)| written.contains(&read.root.as_str()))
            .collect();
        if surface.pick == Pick::First {
            loaded.truncate(1);
        }
        // A guard must not come from a read the user can switch off: with the
        // switch off the runtime would run no guard at all, and say nothing.
        let dependable = |read: &Read| {
            let user = |s: &crate::surface_table::Switch| s.scope == SwitchScope::User;
            read.unsure.is_none()
                && !(kind == Kind::Hooks && read.switch.as_ref().is_some_and(user))
        };
        let (rank, source) = *loaded.iter().find(|(_, read)| dependable(read))?;
        let mut view = View {
            source: source.root.clone(),
            ..View::default()
        };
        for (_, read) in loaded {
            if read.root == source.root {
                continue;
            }
            let switch = read.switch.as_ref();
            if let Some(off) = switch.filter(|s| s.scope == SwitchScope::Project) {
                if !view.switches.contains(&off.set) {
                    view.switches.push(off.set.clone());
                }
            } else {
                view.extras.push(Extra {
                    root: read.root.clone(),
                    unsure: read.unsure.clone(),
                    turn_off: switch.map(|s| s.set.clone()),
                });
            }
        }
        let user = |s: &&crate::surface_table::Switch| s.scope == SwitchScope::User;
        view.depends_on = source.switch.as_ref().filter(user).map(|s| s.set.clone());
        let home = table.home(kind, &source.root);
        cost.duplicates += view.duplicates().count();
        cost.unsettled += view.extras.len() - view.duplicates().count();
        // MCP entries are data with one meaning for every reader.
        cost.foreign += usize::from(kind != Kind::Mcp && home.is_some_and(|h| h != runtime));
        cost.rank += rank;
        out.insert(runtime, view);
    }
    Some((cost, out))
}

fn write(
    table: &SurfaceTable,
    kind: Kind,
    surfaces: &[(Runtime, &KindSurface)],
    views: &BTreeMap<Runtime, View>,
    root: &str,
) -> Option<Write> {
    let lists = |surface: &KindSurface, write: bool| {
        surface
            .roots
            .iter()
            .any(|read| read.root == root && (read.write || !write))
    };
    let owner = surfaces.iter().find(|(_, s)| lists(s, true))?.0;
    let readers: Vec<Runtime> = surfaces
        .iter()
        .filter(|(r, s)| lists(s, false) && views.get(r).is_some_and(|v| loads(v, root)))
        .map(|(r, _)| *r)
        .collect();
    let dialect = match (table.home(kind, root), readers.as_slice()) {
        (Some(home), _) => Dialect::Host(home),
        (None, [only]) => Dialect::Host(*only),
        (None, _) => Dialect::Shared,
    };
    Some(Write {
        root: root.to_owned(),
        dialect,
        owner,
        readers,
    })
}

fn loads(view: &View, root: &str) -> bool {
    view.source == root || view.extras.iter().any(|e| e.root == root)
}

#[cfg(test)]
#[path = "placement_resolver_tests.rs"]
mod tests;
