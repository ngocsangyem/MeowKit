//! `advice validate-packet` — check a packet or brief against its contract.
//!
//! All three shapes are assembled as prose and handed to (or returned by) an
//! agent, so none passes through this CLI on its own. Without this command the
//! caps, pointer budget, provenance requirement, secret and authority scans and
//! the direct/embedded separation were code nothing could reach — real
//! functions, but not an enforcement any workflow could invoke.
//!
//! `brief` is the direct-consult shape and is validated by a DIFFERENT schema on
//! purpose: a brief that carries a disposition is refused, which is what stops a
//! stateless consult from being recorded as a governed checkpoint.
use std::path::Path;

use mewkit_core::advice::evidence::read_json_file;
use mewkit_core::advice::packet_issues::{PacketKind, forbidden_brief_fields, shape_issues};
use mewkit_core::advice::paths::{is_inside, resolve_from};
use mewkit_core::schema::strategy_brief::validate_strategy_brief;
use mewkit_core::schema::supervision_output::validate_output_packet;
use mewkit_core::schema::supervision_packet::validate_input_packet;
use serde_json::Value;

use super::{AdviceArgs, AdviceError, refuse};

pub(super) fn run(project_root: &Path, args: &AdviceArgs) -> Result<(), AdviceError> {
    let file = args.evidence.as_deref().ok_or_else(|| {
        refuse("`advice validate-packet` requires --evidence <path-to-packet.json>.")
    })?;
    // `--correction-kind` used to select the packet shape here and now means
    // source|scope on `commit`. Silently ignoring it would route the caller to
    // the DEFAULT validator — a brief checked against the input-packet schema
    // fails with a confusing shape error instead of saying which flag moved.
    if args.correction_kind.is_some() {
        return Err(refuse(
            "`validate-packet` uses --packet-kind (input|output|brief); --correction-kind is for `commit` (source|scope).",
        ));
    }
    let raw_kind = args.packet_kind.as_deref().unwrap_or("input");
    let Some(kind) = PacketKind::parse(raw_kind) else {
        return Err(refuse(format!(
            "--packet-kind must be input|output|brief, got {raw_kind}."
        )));
    };

    let absolute = resolve_from(project_root, file);
    if !is_inside(project_root, &absolute) {
        return Err(refuse("Refused: --evidence must stay inside the project."));
    }
    let loaded =
        read_json_file(&absolute).map_err(|why| refuse(format!("Cannot read packet: {why}")))?;

    // Shape first, then content — the order the schema itself imposes: a packet
    // whose shape is refused has no fields to scan.
    let mut errors = shape_issues(kind, &loaded);
    if kind == PacketKind::Brief {
        // The forbidden-field findings come first and survive a shape refusal:
        // "you tried to return a disposition from a stateless consult" is the
        // message that matters, and a strict-object error only says the key was
        // unrecognised.
        let mut forbidden = forbidden_brief_fields(&loaded);
        forbidden.extend(errors);
        errors = forbidden;
    }
    if errors.is_empty() {
        let value = Value::Object(loaded);
        errors = match kind {
            PacketKind::Input => validate_input_packet(&value),
            PacketKind::Output => validate_output_packet(&value),
            PacketKind::Brief => validate_strategy_brief(&value),
        }
        .errors;
    }
    if !errors.is_empty() {
        // Refused BEFORE delegation, never truncated to fit: a trimmed packet
        // asks a different question than the one the workflow intended.
        let listed = errors
            .iter()
            .map(|e| format!("  - {e}"))
            .collect::<Vec<_>>()
            .join("\n");
        return Err(refuse(format!(
            "Packet refused ({}):\n{listed}",
            kind.as_str()
        )));
    }

    let label = if kind == PacketKind::Brief {
        "Strategy brief"
    } else {
        "Packet"
    };
    println!("{label} OK ({}).", kind.as_str());
    if kind == PacketKind::Brief {
        println!(
            "  a consult governs no run — it writes no dossier, no receipt, and spends no cap."
        );
    }
    Ok(())
}
