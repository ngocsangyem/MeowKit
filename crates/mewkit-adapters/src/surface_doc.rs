//! The maintainer page for the surface table, rendered from the data so the
//! page and the resolver cannot drift apart.
use std::collections::BTreeMap;
use std::fmt::Write as _;

use crate::contract::Runtime;
use crate::placement_resolver::{Extra, Placement, resolve};
use crate::surface_table::{Kind, Pick, SurfaceTable, SwitchScope};

/// Every non-empty set of runtimes, smallest first.
fn sets() -> Vec<Vec<Runtime>> {
    let mut sets: Vec<Vec<Runtime>> = (1u32..1 << Runtime::ALL.len())
        .map(|mask| {
            let all = Runtime::ALL.into_iter().enumerate();
            all.filter(|(i, _)| mask & (1 << i) != 0)
                .map(|(_, r)| r)
                .collect()
        })
        .collect();
    sets.sort_by_key(Vec::len);
    sets
}

fn names(set: &[Runtime]) -> String {
    let names: Vec<&str> = set.iter().map(|r| r.name()).collect();
    names.join(" + ")
}

fn code(roots: impl Iterator<Item = impl AsRef<str>>) -> String {
    let roots: Vec<String> = roots.map(|r| format!("`{}`", r.as_ref())).collect();
    if roots.is_empty() {
        "none".into()
    } else {
        roots.join(", ")
    }
}

pub fn render(table: &SurfaceTable) -> String {
    let mut out = format!(
        "# Runtime surface table\n\n\
         <!-- Generated from crates/mewkit-adapters/src/surface_table.json. Do not edit: change the \
         data, then run `MEWKIT_BLESS=1 cargo test -p mewkit-adapters --test surface_table_doc`. -->\n\n\
         Which project paths each runtime loads, and where the kit therefore writes for a set of \
         runtimes sharing one project. Collected {}. Project scope only.\n\n\
         A root enters the table with a vendor page, a source file and version, or a probe row. \
         \"Unsure\" marks a read the vendor leaves open: it counts as a possible second copy and is \
         never a runtime's only copy.\n",
        table.collected
    );
    loads(table, &mut out);
    placements(table, &mut out);
    leftovers(table, &mut out);
    out
}

fn loads(table: &SurfaceTable, out: &mut String) {
    out.push_str("\n## What each runtime loads\n");
    for runtime in &table.runtimes {
        let _ = write!(
            out,
            "\n### {}\n\nChecked: {}.\n\n",
            runtime.name, runtime.checked
        );
        out.push_str(
            "| Kind | Root | Kit writes | Unsure | Switch | Source |\n|---|---|---|---|---|---|\n",
        );
        for (kind, surface) in &runtime.kinds {
            for read in &surface.roots {
                let switch = read.switch.as_ref().map_or(String::new(), |s| {
                    let scope = match s.scope {
                        SwitchScope::Project => "project",
                        SwitchScope::User => "user",
                    };
                    format!("{scope}: {}", s.set)
                });
                let _ = writeln!(
                    out,
                    "| {} | `{}` | {} | {} | {} | {} |",
                    kind.name(),
                    read.root,
                    if read.write { "yes" } else { "" },
                    read.unsure.as_deref().unwrap_or(""),
                    switch,
                    read.source
                );
            }
        }
        out.push('\n');
        for (kind, surface) in &runtime.kinds {
            let first = "An item found under several of these roots loads from the first listed.";
            let pick = (surface.pick == Pick::First).then_some(first);
            let note = (!surface.note.is_empty()).then_some(surface.note.as_str());
            let text: Vec<&str> = pick.into_iter().chain(note).collect();
            if !text.is_empty() {
                let _ = writeln!(out, "- {}: {}", kind.name(), text.join(" "));
            }
        }
    }
}

fn placements(table: &SurfaceTable, out: &mut String) {
    out.push_str(
        "\n## Where the kit writes\n\n\
         The resolver tries every combination of writable roots and keeps the one with, in order: \
         the fewest certain double loads, the fewest runtimes reading another runtime's wording, \
         the fewest possible double loads, the fewest roots. One runtime, each pair, and all six:\n\n\
         | Set | Skills | Agents | Always-on | Hooks | MCP |\n|---|---|---|---|---|---|\n",
    );
    let shown = |set: &Vec<Runtime>| set.len() <= 2 || set.len() == Runtime::ALL.len();
    for set in sets().into_iter().filter(shown) {
        let placement = resolve(table, &set);
        let _ = write!(out, "| {} |", names(&set));
        for kind in Kind::ALL {
            let writes = &placement.kinds[&kind].writes;
            let _ = write!(out, " {} |", code(writes.iter().map(|w| &w.root)));
        }
        out.push('\n');
    }
}

/// One extra root a runtime loads, with the smallest sets it happens in.
type Seen = BTreeMap<(Kind, Runtime, String), (Extra, Vec<Vec<Runtime>>)>;

fn collect(placement: &Placement, certain: bool, seen: &mut Seen) {
    for (kind, placed) in &placement.kinds {
        for (runtime, view) in &placed.views {
            let extras = view.extras.iter();
            for extra in extras.filter(|e| e.unsure.is_none() == certain) {
                let key = (*kind, *runtime, extra.root.clone());
                let entry = seen
                    .entry(key)
                    .or_insert_with(|| (extra.clone(), Vec::new()));
                let smallest = entry.1.first().map_or(usize::MAX, Vec::len);
                if placement.set.len() <= smallest {
                    entry.1.push(placement.set.clone());
                }
            }
        }
    }
}

fn leftovers(table: &SurfaceTable, out: &mut String) {
    let placements: Vec<Placement> = sets().iter().map(|set| resolve(table, set)).collect();
    for (certain, heading, intro) in [
        (
            true,
            "Double loads no placement removes",
            "The runtime loads the content from two written roots in every placement of these sets.",
        ),
        (
            false,
            "Reads that are not settled",
            "The runtime may load a second copy from the root; the reason is in the last column.",
        ),
    ] {
        let mut seen = Seen::new();
        for placement in &placements {
            collect(placement, certain, &mut seen);
        }
        let last = if certain {
            "User setting that stops it"
        } else {
            "Why"
        };
        let _ = write!(
            out,
            "\n## {heading}\n\n{intro}\n\n| Kind | Runtime | Also loads | Smallest sets | {last} |\n|---|---|---|---|---|\n"
        );
        for ((kind, runtime, root), (extra, sets)) in seen {
            let sets: Vec<String> = sets.iter().map(|s| names(s)).collect();
            let none = "none documented".to_owned();
            let last = if certain {
                extra.turn_off
            } else {
                extra.unsure
            };
            let _ = writeln!(
                out,
                "| {} | {} | `{root}` | {} | {} |",
                kind.name(),
                runtime.name(),
                sets.join("; "),
                last.unwrap_or(none)
            );
        }
    }
}
