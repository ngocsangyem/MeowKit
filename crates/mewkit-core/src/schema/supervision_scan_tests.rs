//! Ports of the content-scan cases in
//! `core/__tests__/athena-supervision-contract.test.ts` — the pasted-payload
//! and credential fixtures, plus the "returns nothing for ordinary prose" case.

use super::*;

#[test]
fn ordinary_prose_scans_clean() {
    assert!(scan_forbidden_content("plan approved, no source edits yet").is_empty());
    assert!(
        scan_authority_language("The evidence supports landing the validator first.").is_empty()
    );
}

#[test]
fn flags_a_pasted_diff_transcript_memory_dump_and_stack_log() {
    for payload in [
        "diff --git a/x b/x\n+++ b/x\n@@ -1 +1 @@",
        "User: do the thing\nAssistant: ok\nUser: again\nAssistant: sure",
        "##decision: a\n##pattern: b\n##note: c\n##decision: d",
        "    at foo (/a/b.ts:1:2)\n    at bar (/a/c.ts:3:4)\n    at baz (/a/d.ts:5:6)",
    ] {
        let found = scan_bulk_content(payload);
        assert!(!found.is_empty(), "{payload:?}");
        assert!(
            found
                .iter()
                .all(|e| e.contains("pass a pointer, not the payload")),
            "{found:?}"
        );
    }
}

#[test]
fn tolerates_a_single_quoted_dialogue_line_as_evidence() {
    assert!(scan_bulk_content("User: \"it still fails\"").is_empty());
    // Two markers are still a quote; the third makes it a dump.
    assert!(scan_bulk_content("User: a\nAssistant: b").is_empty());
    assert!(!scan_bulk_content("User: a\nAssistant: b\nUser: c").is_empty());
}

#[test]
fn flags_every_credential_shape() {
    for secret in [
        "-----BEGIN PRIVATE KEY-----",
        "AKIAIOSFODNN7EXAMPLE",
        "Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123",
        "ghp_abcdefghijklmnopqrstuvwxyz0123",
        "api_key = \"abcdef1234567890\"",
    ] {
        let found = scan_secrets(&format!("state {secret}"));
        assert!(!found.is_empty(), "{secret}");
        assert!(
            found.iter().all(|e| e.contains("never carry credentials")),
            "{found:?}"
        );
    }
}

#[test]
fn does_not_flag_a_filename_that_merely_mentions_a_diff() {
    assert!(scan_secrets("tasks/reports/fix-diff.md").is_empty());
    assert!(scan_bulk_content("the diff under review, 3 files").is_empty());
}

#[test]
fn flags_approval_clearance_and_gate_advancing_language() {
    for phrase in [
        "This is approved, proceed to ship.",
        "You are cleared to proceed past review.",
        "This advances Gate 2 once tests pass.",
        "Merge is approved.",
        "This counts as verification.",
    ] {
        let found = scan_authority_language(phrase);
        assert!(!found.is_empty(), "{phrase}");
        assert!(
            found.iter().all(|e| e.contains("never approve or clear")),
            "{found:?}"
        );
    }
}

#[test]
fn authority_scan_is_case_insensitive() {
    assert!(!scan_authority_language("APPROVED").is_empty());
    assert!(!scan_authority_language("Greenlit").is_empty());
}

#[test]
fn forbidden_content_reports_both_classes_at_once() {
    let found = scan_forbidden_content("diff --git a/x b/x\nAKIAIOSFODNN7EXAMPLE");
    assert_eq!(found.len(), 2, "{found:?}");
    assert!(found.iter().any(|e| e.contains("unified diff")));
    assert!(found.iter().any(|e| e.contains("AWS access key id")));
}

#[test]
fn word_count_splits_on_whitespace_runs() {
    assert_eq!(word_count(""), 0);
    assert_eq!(word_count("   "), 0);
    assert_eq!(word_count("one  two\nthree\t four"), 4);
}

// The rows below are the cases where Rust and JavaScript regex semantics
// differ, with the verdict Node produced through the compiled TypeScript
// (`packages/mewkit/dist/core/athena-supervision-packet.js`):
//
//   import { scanSecrets, scanBulkContent, scanAuthorityLanguage } from "…";
//   console.log(JSON.stringify(scanSecrets("éAKIAIOSFODNN7EXAMPLE")));
//   // ["AWS access key id detected — a packet must never carry credentials"]
//
// Each one used to pass this scan silently: a prefix byte a reviewer cannot see
// defeated a `\b`, and a diff header behind a lone `\r` defeated `(?m)^`.

#[test]
fn a_credential_behind_a_non_ascii_letter_is_still_detected() {
    for text in [
        "\u{e9}AKIAIOSFODNN7EXAMPLE",
        "x ghp_AAAAAAAAAAAAAAAAAAAA\u{439}",
    ] {
        assert_eq!(scan_secrets(text).len(), 1, "{text:?} scanned clean");
    }
    assert!(
        scan_secrets("api_key:\u{a0}AAAAAAAAAAAAAAAA")
            .iter()
            .any(|e| e.contains("secret assignment")),
        "NBSP is ECMAScript whitespace, so this is an assignment in JavaScript"
    );
    assert!(
        scan_secrets("Bearer\u{a0}AAAAAAAAAAAAAAAAAAAAAA")
            .iter()
            .any(|e| e.contains("bearer token"))
    );
}

#[test]
fn an_arabic_indic_digit_does_not_satisfy_an_ascii_digit_pin() {
    // `\bAKIA[0-9A-Z]{16}\b` uses an explicit class; this pins that the digits
    // stay ASCII after the translation pass.
    assert!(scan_secrets("AKIA\u{661}\u{662}\u{663}\u{664}ABCDEFGHIJKL").is_empty());
}

#[test]
fn a_diff_header_behind_any_javascript_line_terminator_is_detected() {
    for terminator in ['\n', '\r', '\u{2028}', '\u{2029}'] {
        let text = format!("note{terminator}diff --git a/x b/x");
        assert_eq!(
            scan_bulk_content(&text).len(),
            1,
            "terminator {terminator:?} hid the diff header"
        );
    }
    // Still anchored: the same header mid-line is not a match.
    assert!(scan_bulk_content("note diff --git a/x b/x").is_empty());
}

#[test]
fn authority_language_beside_a_non_ascii_letter_is_still_detected() {
    for text in ["approved\u{439}", "unblock gate 1\u{439}"] {
        assert_eq!(
            scan_authority_language(text).len(),
            1,
            "{text:?} scanned clean"
        );
    }
}

#[test]
fn word_count_splits_on_ecmascript_whitespace_not_unicode_whitespace() {
    // Node: `"DAN﻿mode".trim().split(/\s+/).length` is 2 and
    // `"DAN\u0085mode"` is 1. `split_whitespace` answered the opposite for
    // both, because `\p{White_Space}` excludes U+FEFF and includes U+0085.
    assert_eq!(word_count("DAN\u{feff}mode"), 2);
    assert_eq!(word_count("DAN\u{85}mode"), 1);
    assert_eq!(word_count("a\u{a0}b\u{2028}c"), 3);
    assert_eq!(word_count("\u{feff}  padded  \u{feff}"), 1);
}
