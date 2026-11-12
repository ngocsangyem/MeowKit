//! The ONE content scan for the committed team-memory store.
//!
//! Port of `state/memory-content-scan.ts`. `validate --memory` runs it over every
//! file in the store; `mewkit note` runs it over a single entry before appending.
//! Both must agree, or a write the lint would reject could still land.
//!
//! Scan order is cost-ordered and fail-closed: byte cap → flood → per-line
//! (bounded) → whole-body. The whole-body pass exists because a multi-line
//! credential (a PEM block) is unmatchable by construction in a per-line scan, and
//! the per-line pass exists because a finding without a line number is not
//! actionable.
//!
//! A finding NEVER carries the matched text for a credential: the lint output is
//! read in CI logs and in a terminal, so echoing it would turn the guard into a
//! leak.
use super::finding::{ContentFinding, MemoryFindingKind};
use super::flood::is_flood;
use super::injection_patterns::validate_content;
use super::normalize::normalize_for_scan;
use super::obfuscation_passes::{MAX_CONTENT_BYTES, MAX_SCAN_LINE_BYTES, decode_passes};
use super::scrub_patterns::has_secret;

/// Split on any newline convention. A CR-only file is many lines, not one giant
/// line — `split("\n")` saw a 5000-line CR-delimited file as a single line, so the
/// line cap never fired on it.
pub fn split_lines(body: &str) -> Vec<&str> {
    let bytes = body.as_bytes();
    let mut out = Vec::new();
    let mut start = 0;
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'\n' => {
                out.push(&body[start..i]);
                i += 1;
                start = i;
            }
            b'\r' => {
                out.push(&body[start..i]);
                i += if bytes.get(i + 1) == Some(&b'\n') {
                    2
                } else {
                    1
                };
                start = i;
            }
            _ => i += 1,
        }
    }
    out.push(&body[start..]);
    out
}

/// Count lines the way a reviewer does: a trailing newline does not add a line.
pub fn count_lines(body: &str) -> usize {
    if body.is_empty() {
        return 0;
    }
    let lines = split_lines(body);
    if lines.last() == Some(&"") {
        lines.len() - 1
    } else {
        lines.len()
    }
}

/// First injection hit across every decode pass (Rule 8), or `None`.
///
/// Returns the PATTERN source rather than the match when the hit came from a
/// decoded view — the decoded text is attacker-controlled and does not belong
/// verbatim in a log line.
fn first_injection(text: &str) -> Option<String> {
    let normalized = normalize_for_scan(text);
    if let Some(hit) = validate_content(&normalized) {
        return Some(hit.matched);
    }
    for view in decode_passes(&normalized).iter().skip(1) {
        if let Some(hit) = validate_content(view) {
            return Some(format!("obfuscated: {}", hit.pattern));
        }
    }
    None
}

/// Scan one body of memory content with the default per-file byte cap.
pub fn scan_memory_content(body: &str) -> Vec<ContentFinding> {
    scan_memory_content_capped(body, MAX_CONTENT_BYTES)
}

/// Scan one body of memory content. An empty vector means clean.
///
/// Over the byte cap the scan STOPS: the content is reported and nothing is
/// scanned, so an oversized payload can neither pass silently nor cost unbounded
/// CPU.
pub fn scan_memory_content_capped(body: &str, max_bytes: usize) -> Vec<ContentFinding> {
    let bytes = body.len();
    if bytes > max_bytes {
        return vec![ContentFinding {
            line: 0,
            kind: MemoryFindingKind::ByteCap,
            detail: format!(
                "{bytes} bytes exceeds the {max_bytes}-byte cap — not scanned; split or prune the content"
            ),
        }];
    }

    let mut findings = Vec::new();
    if is_flood(body) {
        findings.push(ContentFinding {
            line: 0,
            kind: MemoryFindingKind::Flood,
            detail: "large and highly repetitive — reads as context-window padding, not recall"
                .to_string(),
        });
    }

    let mut saw_line_injection = false;
    let mut saw_line_secret = false;
    for (index, line) in split_lines(body).iter().enumerate() {
        if line.len() > MAX_SCAN_LINE_BYTES {
            // Bounded cost: report and skip rather than run every pattern over a
            // pasted blob.
            findings.push(ContentFinding {
                line: index + 1,
                kind: MemoryFindingKind::LongLine,
                detail: format!(
                    "line is over {MAX_SCAN_LINE_BYTES} bytes and was not scanned — wrap it or link to the source"
                ),
            });
            continue;
        }
        if let Some(injection) = first_injection(line) {
            findings.push(ContentFinding {
                line: index + 1,
                kind: MemoryFindingKind::Injection,
                detail: format!("instruction-like text: {injection}"),
            });
            saw_line_injection = true;
        }
        if has_secret(line) {
            findings.push(ContentFinding {
                line: index + 1,
                kind: MemoryFindingKind::Secret,
                detail: "matches a secret pattern".to_string(),
            });
            saw_line_secret = true;
        }
    }

    // Whole-body pass: catches what spans lines (a PEM block, a payload split
    // across an HTML comment). Suppressed when the per-line pass already reported
    // the same kind, so the same problem is not counted twice.
    if !saw_line_injection && let Some(injection) = first_injection(body) {
        findings.push(ContentFinding {
            line: 0,
            kind: MemoryFindingKind::Injection,
            detail: format!("instruction-like text spanning lines: {injection}"),
        });
    }
    if !saw_line_secret && has_secret(body) {
        findings.push(ContentFinding {
            line: 0,
            kind: MemoryFindingKind::Secret,
            detail: "matches a secret pattern spanning lines".to_string(),
        });
    }

    findings
}
