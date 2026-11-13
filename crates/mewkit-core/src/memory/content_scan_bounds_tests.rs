// Ports the "Rule 9 flood and the bounds" and "line splitting" cases of
// `state/__tests__/memory-content-scan.test.ts`: what the scan does when content is
// too big to scan, and how it counts lines.
use super::*;

fn kinds(body: &str) -> Vec<&'static str> {
    scan_memory_content(body)
        .iter()
        .map(|f| f.kind.as_str())
        .collect()
}

#[test]
fn flags_a_context_flood_payload() {
    assert!(kinds(&"spam line\n".repeat(2000)).contains(&"flood"));
}

#[test]
fn rejects_content_over_the_byte_cap_without_scanning_it() {
    let findings = scan_memory_content_capped(&"a".repeat(2048), 1024);
    assert_eq!(findings.len(), 1);
    assert_eq!(findings[0].kind, MemoryFindingKind::ByteCap);
    assert_eq!(
        findings[0].detail,
        "2048 bytes exceeds the 1024-byte cap — not scanned; split or prune the content"
    );
}

#[test]
fn reports_an_over_long_line_instead_of_scanning_it() {
    let long = "a".repeat(MAX_SCAN_LINE_BYTES + 1);
    assert!(kinds(&format!("## x\n{long}\n")).contains(&"long-line"));
}

#[test]
fn bounds_the_scan_a_2mb_single_line_is_reported_not_scanned() {
    let started = std::time::Instant::now();
    let findings =
        scan_memory_content_capped(&format!("## x\n{}\n", "a".repeat(2_000_000)), 4_000_000);
    assert!(
        findings
            .iter()
            .any(|f| f.kind == MemoryFindingKind::LongLine)
    );
    // The TS budget is 2s, which is what an optimised build spends (~0.12s here).
    // An unoptimised test build runs the whole-body pass an order of magnitude
    // slower, so the budget follows the profile instead of the assertion being
    // dropped — the property under test is "bounded", not "fast". ~3s alone in a
    // debug build, but a shared CI runner executing the whole lib suite in
    // parallel has taken 15.7s; an unbounded scan of 2MB would take far longer
    // than 60s, so that budget still tells the two apart.
    let budget = if cfg!(debug_assertions) { 60 } else { 2 };
    assert!(
        started.elapsed() < std::time::Duration::from_secs(budget),
        "took {:?}, budget {budget}s",
        started.elapsed()
    );
}

#[test]
fn treats_a_cr_only_file_as_many_lines_not_one() {
    // `split("\n")` saw a 5000-line CR-delimited file as a single line, so the line
    // cap never fired on it.
    assert_eq!(count_lines(&"a\r".repeat(500)), 500);
    assert_eq!(split_lines("a\rb\nc\r\nd"), vec!["a", "b", "c", "d"]);
}

#[test]
fn does_not_count_a_trailing_newline_as_an_extra_line() {
    assert_eq!(count_lines("one\ntwo\n"), 2);
    assert_eq!(count_lines(""), 0);
}
