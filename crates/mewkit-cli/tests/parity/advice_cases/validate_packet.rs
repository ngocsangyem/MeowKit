//! `advice validate-packet` — the reachable surface of the packet contracts.
use super::advice;
use super::fixtures::PACKETS;

/// `validate-packet --evidence packets/<file>` plus whatever else the case needs.
fn check(
    name: &'static str,
    file: &str,
    extra: &[&str],
) -> Option<(crate::parity::Run, crate::parity::Run)> {
    let path = format!("packets/{file}");
    let mut args = vec!["validate-packet", "--evidence", &path];
    args.extend_from_slice(extra);
    advice(name, Some(PACKETS), &args).run()
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_complete_input_packet_passes_and_writes_nothing() {
    let Some((ts, _)) = check("advice-packet-input-ok", "input-ok.json", &[]) else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert_eq!(ts.stdout, "Packet OK (input).\n");
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_refused_packet_names_every_problem_at_once() {
    let Some((ts, _)) = check("advice-packet-input-broken", "input-broken.json", &[]) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(ts.stderr.contains("Packet refused (input):"));
    // Schema order, with the strict object's unrecognised keys last — one
    // round-trip fixes the packet.
    for issue in [
        "  - runId: Expected string, received number",
        "  - stage: Invalid enum value. Expected 'GUIDE' | 'RESCUE' | 'REVIEW' | 'RECHECK', received 'BOGUS'",
        "  - evidenceRefs.0.provenance: Required",
        "  - (root): Unrecognized key(s) in object: 'extraKey'",
    ] {
        assert!(
            ts.stderr.contains(issue),
            "missing {issue} in {}",
            ts.stderr
        );
    }
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_brief_is_checked_by_its_own_schema_and_says_it_governs_no_run() {
    let Some((ts, _)) = check(
        "advice-packet-brief-ok",
        "brief-ok.json",
        &["--packet-kind", "brief"],
    ) else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(ts.stdout.contains("Strategy brief OK (brief)."));
    assert!(ts.stdout.contains(
        "a consult governs no run — it writes no dossier, no receipt, and spends no cap."
    ));
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_stateless_consult_cannot_return_a_routing_decision() {
    let Some((ts, _)) = check(
        "advice-packet-brief-claims-supervision",
        "brief-claims-supervision.json",
        &["--packet-kind", "brief"],
    ) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr.contains(
            "\"disposition\" belongs to embedded supervision — a direct consult is stateless and routes no workflow"
        ),
        "the refusal names the field that claimed supervision: {}",
        ts.stderr
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn counsel_that_claims_authority_is_refused() {
    let Some((ts, _)) = check(
        "advice-packet-output-authority",
        "output-claims-authority.json",
        &["--packet-kind", "output"],
    ) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(ts.stderr.contains("Packet refused (output):"));
    assert!(
        ts.stderr.contains("approval claim in counsel"),
        "{}",
        ts.stderr
    );
    assert!(
        ts.stderr.contains("clearance claim in counsel"),
        "{}",
        ts.stderr
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn an_unreadable_packet_is_refused_rather_than_guessed_at() {
    for (name, file, expected) in [
        (
            "advice-packet-not-json",
            "not-json.json",
            "is not valid JSON",
        ),
        (
            "advice-packet-not-an-object",
            "not-an-object.json",
            "is not a JSON object",
        ),
        (
            "advice-packet-missing",
            "missing.json",
            "Cannot read packet: evidence file not found:",
        ),
    ] {
        let Some((ts, _)) = check(name, file, &[]) else {
            return;
        };
        assert_eq!(ts.code, 1, "{}", ts.describe());
        assert!(ts.stderr.contains(expected), "{}", ts.describe());
    }
}

#[test]
#[ignore = "needs node and the TS build"]
fn the_flag_that_moved_is_named_rather_than_silently_ignored() {
    // `--correction-kind` used to select the packet shape and now means
    // source|scope on `commit`; ignoring it would route the caller to the
    // DEFAULT validator and refuse a brief with a confusing shape error.
    let Some((ts, _)) = check(
        "advice-packet-wrong-kind-flag",
        "input-ok.json",
        &["--correction-kind", "source"],
    ) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("`validate-packet` uses --packet-kind (input|output|brief)")
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn an_unknown_packet_kind_and_a_missing_path_are_both_refused() {
    let Some((ts, _)) = check(
        "advice-packet-bad-kind",
        "input-ok.json",
        &["--packet-kind", "sideways"],
    ) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("--packet-kind must be input|output|brief, got sideways.")
    );

    let Some((ts, _)) = advice(
        "advice-packet-no-evidence",
        Some(PACKETS),
        &["validate-packet"],
    )
    .run() else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("`advice validate-packet` requires --evidence <path-to-packet.json>.")
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_packet_outside_the_project_is_refused_before_it_is_read() {
    let Some((ts, _)) = advice(
        "advice-packet-outside-project",
        Some(PACKETS),
        &["validate-packet", "--evidence", "../escape.json"],
    )
    .run() else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("Refused: --evidence must stay inside the project.")
    );
}
