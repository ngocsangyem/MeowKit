//! `capabilities` against both CLIs.
//!
//! `resolve` is the one that matters most: the kit's SessionStart hook tells
//! agents to run `mewkit capabilities resolve --intent "..."` and act on what
//! it prints, so its text and its JSON are compared on every outcome
//! (`selected`, `ambiguous`, `unavailable`, no match) and every refusal.
//!
//! Shared with the npm CLI, on purpose: `projections --provider <p>` is
//! accepted and ignored by both (the catalogue lists the flag, the handler
//! never reads it), and an interactive `bootstrap --write` into a `.claude/`
//! with no `hooks/references/` fails in both.
use crate::parity;

const INSTALL: &str = "capabilities-install";

fn caps(
    name: &'static str,
    fixture: &'static str,
    args: &[&str],
) -> Option<(parity::Run, parity::Run)> {
    let mut argv = vec!["capabilities"];
    argv.extend_from_slice(args);
    parity::case(name).fixture(fixture).args(&argv).run()
}

#[test]
#[ignore = "needs node and the TS build"]
fn list_groups_by_kind_and_reports_the_manifest_issues() {
    let Some((ts, _)) = caps("capabilities-list", INSTALL, &[]) else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    for expected in [
        "MeowKit Capabilities",
        "skill\n  mk:cook",
        "tool\n  browser",
        "[WARN]",
    ] {
        assert!(
            ts.stdout.contains(expected),
            "missing {expected:?}: {}",
            ts.describe()
        );
    }
}

#[test]
#[ignore = "needs node and the TS build"]
fn list_json_prints_every_entry_in_manifest_key_order() {
    let Some((ts, _)) = caps("capabilities-list-json", INSTALL, &["list", "--json"]) else {
        return;
    };
    assert!(
        ts.stdout.contains("\"contextRequirement\""),
        "{}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn explain_prints_one_entry_as_text_and_as_json() {
    let Some((ts, _)) = caps("capabilities-explain", INSTALL, &["explain", "mk:cook"]) else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout.contains("intents:     implement this feature"),
        "{}",
        ts.describe()
    );
    caps(
        "capabilities-explain-json",
        INSTALL,
        &["explain", "mk:scout", "--json"],
    );
    // An authored entry has no disk artifact, and its requirements are listed.
    let Some((authored, _)) = caps(
        "capabilities-explain-authored",
        INSTALL,
        &["explain", "jira"],
    ) else {
        return;
    };
    assert!(
        authored.stdout.contains("(authored, no disk artifact)"),
        "{}",
        authored.describe()
    );
    assert!(
        authored.stdout.contains("mcp_or_app:jira"),
        "{}",
        authored.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn explain_refuses_a_missing_or_unknown_id() {
    let Some((ts, _)) = caps("capabilities-explain-none", INSTALL, &["explain"]) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(ts.stderr.contains("requires a capability id"));
    let Some((ts, _)) = caps(
        "capabilities-explain-unknown",
        INSTALL,
        &["explain", "mk:nope"],
    ) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(ts.stderr.contains("No capability with id \"mk:nope\""));
}

#[test]
#[ignore = "needs node and the TS build"]
fn resolve_selects_the_owner_of_an_authored_intent() {
    let Some((ts, _)) = caps(
        "capabilities-resolve-selected",
        INSTALL,
        &["resolve", "--intent", "scout the codebase"],
    ) else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(ts.stdout.contains("— status:"), "{}", ts.describe());
    assert!(ts.stdout.contains("mk:scout"), "{}", ts.describe());
    assert!(
        ts.stdout.contains("needs repo context"),
        "{}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn resolve_json_carries_availability_acquisition_and_adapter_citation() {
    let Some((ts, _)) = caps(
        "capabilities-resolve-json",
        INSTALL,
        &["resolve", "--intent", "implement this feature", "--json"],
    ) else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    for key in ["\"adapterCitation\"", "\"acquisition\"", "\"gatingEvents\""] {
        assert!(ts.stdout.contains(key), "missing {key}: {}", ts.describe());
    }
}

#[test]
#[ignore = "needs node and the TS build"]
fn resolve_reads_a_positional_phrase_when_there_is_no_intent_flag() {
    let Some((ts, _)) = caps(
        "capabilities-resolve-positional",
        INSTALL,
        &["resolve", "plan this feature"],
    ) else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
}

#[test]
#[ignore = "needs node and the TS build"]
fn resolve_reports_availability_from_the_host() {
    // jira: declared in .mcp.json → available; project-context: path absent →
    // unavailable; trace-log: this CLI is on the path of the running process.
    for (name, intent) in [
        ("capabilities-resolve-mcp", "jira issue"),
        ("capabilities-resolve-file", "load project context"),
        ("capabilities-resolve-self", "record friction"),
        ("capabilities-resolve-binary", "browser automation"),
    ] {
        let Some((ts, _)) = caps(name, INSTALL, &["resolve", "--intent", intent]) else {
            return;
        };
        assert_eq!(ts.code, 0, "{}", ts.describe());
        assert!(ts.stdout.contains("→"), "{name}: {}", ts.describe());
    }
}

#[test]
#[ignore = "needs node and the TS build"]
fn resolve_names_a_near_tie_as_ambiguous_and_no_match_as_unavailable() {
    // Two inferred keywords on mk:deploy and a description hit on mk:cook.
    caps(
        "capabilities-resolve-tie",
        INSTALL,
        &["resolve", "--intent", "release production"],
    );
    let Some((ts, _)) = caps(
        "capabilities-resolve-nomatch",
        INSTALL,
        &["resolve", "--intent", "zzzz qqqq"],
    ) else {
        return;
    };
    assert!(
        ts.stdout.contains("No capability matched this intent."),
        "{}",
        ts.describe()
    );
    caps(
        "capabilities-resolve-nomatch-json",
        INSTALL,
        &["resolve", "--intent", "zzzz qqqq", "--json"],
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn resolve_takes_the_provider_the_host_names() {
    caps(
        "capabilities-resolve-codex",
        INSTALL,
        &[
            "resolve",
            "--intent",
            "scout the codebase",
            "--provider",
            "codex",
        ],
    );
    caps(
        "capabilities-resolve-codex-json",
        INSTALL,
        &[
            "resolve",
            "--intent",
            "plan this feature",
            "--provider",
            "codex",
            "--json",
        ],
    );
    caps(
        "capabilities-resolve-unknown-provider",
        INSTALL,
        &[
            "resolve",
            "--intent",
            "review this code",
            "--provider",
            "zed",
        ],
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn resolve_refuses_without_an_intent() {
    let Some((ts, _)) = caps("capabilities-resolve-empty", INSTALL, &["resolve"]) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(ts.stderr.contains("requires an intent"));
}

#[test]
#[ignore = "needs node and the TS build"]
fn view_renders_the_generated_intent_table() {
    let Some((ts, _)) = caps("capabilities-view", INSTALL, &["view"]) else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout.starts_with("| Capability | Kind |"),
        "{}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn bootstrap_prints_the_approved_text_or_refuses_a_report_only_provider() {
    let Some((ts, _)) = caps("capabilities-bootstrap", "empty-project", &["bootstrap"]) else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout.contains("mewkit capabilities resolve --intent"),
        "{}",
        ts.describe()
    );
    caps(
        "capabilities-bootstrap-codex",
        "empty-project",
        &["bootstrap", "--provider", "codex"],
    );
    let Some((ts, _)) = caps(
        "capabilities-bootstrap-qwen",
        "empty-project",
        &["bootstrap", "--provider", "qwen"],
    ) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("Projected: claude-code, claude-plugin, codex."),
        "{}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn bootstrap_write_regenerates_the_committed_hook_file() {
    let Some((ts, _)) = parity::case("capabilities-bootstrap-write")
        .fixture(INSTALL)
        .args(&["capabilities", "bootstrap", "--write"])
        .writes(&[".claude/hooks/references/capability-bootstrap.md"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(ts.stdout.contains("Wrote .claude"), "{}", ts.describe());
    let Some((ts, _)) = caps(
        "capabilities-bootstrap-write-no-claude",
        "validate-empty",
        &["bootstrap", "--write"],
    ) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr.contains("Could not find .claude/"),
        "{}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn projections_report_every_provider_and_ignore_the_provider_flag() {
    let Some((ts, _)) = caps(
        "capabilities-projections",
        "empty-project",
        &["projections"],
    ) else {
        return;
    };
    assert!(
        ts.stdout.contains("qwen (report-only, placement: none)"),
        "{}",
        ts.describe()
    );
    caps(
        "capabilities-projections-json",
        "empty-project",
        &["projections", "--json"],
    );
    caps(
        "capabilities-projections-provider",
        "empty-project",
        &["projections", "--provider", "codex"],
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_mistyped_subcommand_is_an_invocation_error() {
    let Some((ts, _)) = caps("capabilities-unknown-sub", INSTALL, &["lst"]) else {
        return;
    };
    assert_eq!(ts.code, 2, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("Valid subcommands: list, explain, resolve, view, bootstrap, projections")
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn without_any_source_the_verbs_that_need_one_refuse() {
    let Some((ts, _)) = caps("capabilities-no-source", "validate-empty", &["list"]) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr.contains("Could not find a capability source"),
        "{}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_codex_snapshot_stands_in_when_there_is_no_claude_directory() {
    let Some((ts, _)) = caps("capabilities-codex-list", "capabilities-codex", &["list"]) else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    caps(
        "capabilities-codex-list-json",
        "capabilities-codex",
        &["list", "--json"],
    );
    caps(
        "capabilities-codex-explain",
        "capabilities-codex",
        &["explain", "browser", "--json"],
    );
    caps(
        "capabilities-codex-resolve",
        "capabilities-codex",
        &[
            "resolve",
            "--intent",
            "scout the codebase",
            "--provider",
            "codex",
            "--json",
        ],
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_snapshot_naming_an_unknown_invocation_id_is_refused() {
    // The npm CLI throws, so its stderr is a stack trace; both exit 1 and name the id.
    let Some((ts, rust)) = parity::case("capabilities-bad-snapshot")
        .fixture("capabilities-bad-snapshot")
        .args(&["capabilities", "list"])
        .ignore_stderr(
            "the npm CLI prints an uncaught-exception stack trace; the Rust CLI prints the message",
        )
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr.contains("unknown invocation id for evil"),
        "{}",
        ts.describe()
    );
    assert!(
        rust.stderr.contains("unknown invocation id for evil"),
        "{}",
        rust.describe()
    );
}

// ── providers --lifecycle ─────────────────────────────────────────────────
//
// The adapter tables behind `capabilities resolve` are the ones this view
// prints, so its cases live beside them. The npm CLI's default `providers`
// view (a support matrix from its retired migrate layer) and the Codex
// skill-parity footer are NOT ported and so are not compared.

fn lifecycle(name: &'static str, args: &[&str]) -> Option<(parity::Run, parity::Run)> {
    let mut argv = vec!["providers"];
    argv.extend_from_slice(args);
    parity::case(name)
        .fixture("validate-empty")
        .args(&argv)
        .run()
}

#[test]
#[ignore = "needs node and the TS build"]
fn the_lifecycle_matrix_lists_every_event_for_every_adapted_provider() {
    let Some((ts, _)) = lifecycle("providers-lifecycle-matrix", &["--lifecycle"]) else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout.contains("pre_tool          ok!"),
        "{}",
        ts.describe()
    );
    lifecycle(
        "providers-lifecycle-matrix-json",
        &["--lifecycle", "--json"],
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn one_provider_prints_its_adapter_detail() {
    for (name, provider) in [
        ("providers-lifecycle-claude-code", "claude-code"),
        ("providers-lifecycle-claude-plugin", "claude-plugin"),
        ("providers-lifecycle-codex", "codex"),
    ] {
        let Some((ts, _)) = lifecycle(name, &[provider, "--lifecycle"]) else {
            return;
        };
        assert_eq!(ts.code, 0, "{}", ts.describe());
        assert!(ts.stdout.contains("Invocation shapes"), "{}", ts.describe());
    }
    let Some((ts, _)) = lifecycle(
        "providers-lifecycle-codex-json",
        &["codex", "--lifecycle", "--json"],
    ) else {
        return;
    };
    assert!(
        ts.stdout.contains("\"enforcementGaps\""),
        "{}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_provider_without_an_adapter_reports_everything_unknown() {
    let Some((ts, _)) = lifecycle("providers-lifecycle-unknown", &["zed", "--lifecycle"]) else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(ts.stdout.contains("[report-only]"), "{}", ts.describe());
    lifecycle(
        "providers-lifecycle-unknown-json",
        &["zed", "--lifecycle", "--json"],
    );
    // cursor has invocation shapes of its own but no projection.
    lifecycle("providers-lifecycle-cursor", &["cursor", "--lifecycle"]);
}
