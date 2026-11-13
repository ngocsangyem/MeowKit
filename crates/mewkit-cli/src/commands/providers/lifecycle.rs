//! `providers --lifecycle`: the capability-adapter view. With no provider it
//! is the lifecycle-event matrix over every adapted provider; with one it is
//! that provider's full adapter detail. `--json` prints the adapter view
//! verbatim (an array for all providers).
//!
//! The adapter tables are the same ones `capabilities resolve` cites
//! (`mewkit_core::capability`), so the two verbs cannot disagree. Plain text;
//! colour is not ported. The Codex skill-parity footer the npm CLI appends is
//! not ported either: it depends on the retired migrate classifier.
use mewkit_core::capability::adapter::{ADAPTED_PROVIDERS, AdapterView, describe_provider};
use mewkit_core::capability::lifecycle::LIFECYCLE_EVENTS;
use serde_json::Value;

use crate::failure::{Failure, OK};

fn pad(value: &str, width: usize) -> String {
    let len = value.chars().count();
    if len >= width {
        value.to_string()
    } else {
        format!("{value}{}", " ".repeat(width - len))
    }
}

pub fn run(provider: Option<&str>, json: bool) -> Result<u8, Failure> {
    if json {
        let payload = match provider {
            Some(p) => describe_provider(p).to_json(),
            None => Value::Array(
                ADAPTED_PROVIDERS
                    .iter()
                    .map(|p| describe_provider(p).to_json())
                    .collect(),
            ),
        };
        println!(
            "{}",
            serde_json::to_string_pretty(&payload).unwrap_or_default()
        );
    } else if let Some(p) = provider {
        detail(&describe_provider(p));
    } else {
        matrix();
    }
    Ok(OK)
}

/// `ok`/`adv`/`no`/`?`, with a trailing `!` for a proven gate.
fn cell(status: &str, gate: bool) -> String {
    let g = if gate { "!" } else { " " };
    match status {
        "supported" => format!("ok{g}"),
        "advisory" => format!("adv{g}"),
        "unsupported" => format!("no {g}"),
        _ => "?  ".to_string(),
    }
}

fn matrix() {
    println!("Provider lifecycle-event support (Phase 6)");
    println!(
        "ok = fires · adv = fires, version-gated/observe · no = absent · ? = unknown · ! = proven gate (deny/block)"
    );
    println!();
    let views: Vec<AdapterView> = ADAPTED_PROVIDERS
        .iter()
        .map(|p| describe_provider(p))
        .collect();
    let header: String = views.iter().map(|v| pad(&v.provider, 15)).collect();
    println!("  {}{header}", pad("EVENT", 18));
    for (i, event) in LIFECYCLE_EVENTS.iter().enumerate() {
        let cells: String = views
            .iter()
            .map(|v| {
                let s = &v.lifecycle[i].1;
                pad(&cell(s.status, s.gate), 15)
            })
            .collect();
        println!("  {}{cells}", pad(event, 18));
    }
    println!();
    println!(
        "Run `mewkit providers <provider> --lifecycle` for support levels, acquisition, storage, and evidence."
    );
}

fn detail(view: &AdapterView) {
    let p = &view.projection;
    let [d, s, i, e] = p.levels;
    println!("Capability adapter — {} [{}]", view.provider, p.status);
    println!("  support levels: discoverable {d}, selectable {s}, invocable {i}, enforceable {e}");
    println!("  bootstrap: {}", p.bootstrap_placement);
    let tool = |t: &Option<mewkit_core::capability::projection::AcquisitionTool>| {
        t.as_ref().map_or("(none)", |t| t.tool)
    };
    println!(
        "  acquisition: read {}, search {} [{}]",
        tool(&view.acquisition.read),
        tool(&view.acquisition.search),
        view.acquisition.status
    );
    println!("  storage: {}", view.storage_boundary());
    let gates = if view.gating_events.is_empty() {
        "none (no proven deny/block)".to_string()
    } else {
        view.gating_events.join(", ")
    };
    println!("  gating events: {gates}");
    if view.enforcement_gaps.is_empty() {
        println!("  enforcement gaps: none — all safety deny events can block");
    } else {
        println!(
            "  ⚠ security/privacy enforcement gaps ({}):",
            view.enforcement_gaps.len()
        );
        for g in &view.enforcement_gaps {
            println!("      {}: {}", g.event, g.reason);
        }
    }
    println!();
    println!("  Invocation shapes");
    for (id, shape) in &view.invocation {
        println!(
            "    {} {} {}",
            pad(id, 16),
            pad(shape.support, 12),
            shape.operation
        );
    }
    println!();
    println!("  Workflow operations");
    for (op, shape) in &view.operations {
        println!(
            "    {} {} {}",
            pad(op, 16),
            pad(shape.support, 12),
            shape.operation
        );
        // A fallback nobody is told about is indistinguishable from real support.
        if let Some(fallback) = shape.fallback {
            println!("    {} ↳ fallback: {fallback}", pad("", 16));
        }
    }
    println!();
    println!("  Lifecycle events");
    for (event, s) in &view.lifecycle {
        let gate = if s.gate { " [gate]" } else { "" };
        println!("    {} {}{gate} — {}", pad(event, 18), s.status, s.evidence);
    }
}
