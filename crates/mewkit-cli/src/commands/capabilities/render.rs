//! The text views of `capabilities`: explain, resolve and projections.
//! Plain text throughout; colour is not ported.
use mewkit_core::capability::entry::Entry;
use mewkit_core::capability::projection::{PROJECTION_PROVIDERS, get_projection};
use mewkit_core::capability::resolve::Resolution;
use serde_json::Value;

fn or_none(text: String) -> String {
    if text.is_empty() {
        "(none)".to_string()
    } else {
        text
    }
}

pub fn explain(entry: &Entry) {
    println!("Capability: {}", entry.id);
    println!("  kind:        {}", entry.kind);
    println!(
        "  description: {}",
        if entry.description.is_empty() {
            "(none)"
        } else {
            &entry.description
        }
    );
    println!(
        "  source:      {}",
        entry
            .source_path
            .as_deref()
            .unwrap_or("(authored, no disk artifact)")
    );
    println!(
        "  owner:       {} / {}",
        if entry.owner.is_empty() {
            "(unknown)"
        } else {
            &entry.owner
        },
        entry.installed_state
    );
    println!(
        "  invocation:  {}:{}",
        entry.invocation_kind, entry.invocation_id
    );
    println!("  intents:     {}", or_none(entry.intents.join(", ")));
    let requires: Vec<String> = entry
        .requirements
        .iter()
        .map(|r| format!("{}:{}", r.kind, r.id))
        .collect();
    println!("  requires:    {}", or_none(requires.join(", ")));
    let verify = match &entry.verification_id {
        Some(id) if !id.is_empty() => format!("{}:{id}", entry.verification_kind),
        _ => entry.verification_kind.clone(),
    };
    println!("  verify:      {verify}");
    let provenance: Vec<String> = entry
        .provenance
        .iter()
        .map(|(k, v)| format!("{k}={}", v.as_str().unwrap_or_default()))
        .collect();
    println!("  provenance:  {}", or_none(provenance.join(", ")));
}

pub fn resolve(r: &Resolution) {
    println!(
        "Resolve: \"{}\" (host: {}) — status: {}",
        r.intent, r.provider, r.status
    );
    if r.candidates.is_empty() {
        println!("  No capability matched this intent.");
        return;
    }
    for c in &r.candidates {
        println!("  {} ({}, score {}) — {}", c.id, c.kind, c.score, c.reason);
        println!(
            "      invocable: {}; verify: {}",
            c.invocable, c.verification_kind
        );
        for a in &c.availability {
            println!("      • {}:{} → {}", a.requirement_type, a.id, a.status);
        }
    }
    // When the selected candidate needs repo context, say how this provider
    // acquires it: the agent runs those tools, then records the envelope.
    if let Some(reason) = r.candidates[0].context_reason.as_deref() {
        let acq = &r.acquisition;
        println!(
            "  needs repo context ({reason}) — acquire via {} [{}]:",
            acq.provider, acq.status
        );
        let read = acq.read.as_ref().map_or(
            "(no read surface — host-provided paths only)".to_string(),
            |t| format!("{} — {}", t.tool, t.note),
        );
        let search = acq
            .search
            .as_ref()
            .map_or("(no search surface — report-only)".to_string(), |t| {
                format!("{} — {}", t.tool, t.note)
            });
        println!("      read:   {read}");
        println!("      search: {search}");
    }
    let p = &r.projection;
    println!("  adapter: {} [{}] — {}", p.provider, p.status, p.evidence);
    let gates = if r.gating_events.is_empty() {
        "no events (advisory host)".to_string()
    } else {
        r.gating_events.join(", ")
    };
    println!("  can gate on: {gates}");
}

/// Report how the capability surface projects into each provider.
pub fn projections(json: bool) {
    let all: Vec<_> = PROJECTION_PROVIDERS
        .iter()
        .map(|p| get_projection(p))
        .collect();
    if json {
        let list: Vec<Value> = all.iter().map(|p| p.to_json()).collect();
        println!(
            "{}",
            serde_json::to_string_pretty(&list).unwrap_or_default()
        );
        return;
    }
    println!("Capability provider projections");
    println!(
        "Four independent levels; `enforceable` is claimed only where a real gating hook exists.\n"
    );
    for p in &all {
        println!(
            "{} ({}, placement: {})",
            p.provider, p.status, p.bootstrap_placement
        );
        let [d, s, i, e] = p.levels;
        println!("  discoverable={d}  selectable={s}  invocable={i}  enforceable={e}");
        println!("  {}\n", p.evidence);
    }
    println!("Providers not listed are report-only — no capability behavior is claimed for them.");
}
