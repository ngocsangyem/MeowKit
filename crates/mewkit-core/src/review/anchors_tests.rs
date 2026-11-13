use super::{AnchorMiss, resolve_anchor};

// Written without line continuations: the CONTEXT line's leading space is
// what tells the walker to advance the new-file counter, and a continuation
// would strip it.
const DIFF: &str = "diff --git a/src/a.ts b/src/a.ts\n--- a/src/a.ts\n+++ b/src/a.ts\n\
     @@ -1,2 +1,4 @@\n const keep = 0;\n-const gone = 1;\n+const x = 1;\n\
     +const  y   =  2;\ndiff --git a/src/b.ts b/src/b.ts\n@@ -1,0 +9,1 @@\n+const x = 1;\n";

#[test]
fn a_snippet_pins_to_its_line_in_the_new_file() {
    let anchor = resolve_anchor(DIFF, "src/a.ts", "const x = 1;").expect("one match");
    // Line 1 is the context line, the removed line does not advance, so the
    // added line is 2 in the NEW file.
    assert_eq!((anchor.line, anchor.file.as_str()), (2, "src/a.ts"));
    assert_eq!(anchor.snippet, "const x = 1;");
}

#[test]
fn the_same_snippet_in_another_file_is_not_a_second_hit() {
    // `src/b.ts` also adds `const x = 1;` — scoping by file is what keeps the
    // anchor unambiguous.
    let anchor = resolve_anchor(DIFF, "src/b.ts", "const x = 1;").expect("one match");
    assert_eq!(anchor.line, 9);
}

#[test]
fn a_whitespace_variant_matches_only_when_nothing_matches_exactly() {
    let anchor = resolve_anchor(DIFF, "src/a.ts", "const y = 2;").expect("a fuzzy match");
    assert_eq!(anchor.line, 3);
}

#[test]
fn an_absent_or_repeated_snippet_is_refused() {
    assert_eq!(
        resolve_anchor(DIFF, "src/a.ts", "nothing like this").unwrap_err(),
        AnchorMiss::NotFound
    );
    assert_eq!(
        resolve_anchor(DIFF, "src/a.ts", "   ").unwrap_err(),
        AnchorMiss::NotFound
    );
    // A removed line is not in the new file, so it can never be an anchor.
    assert_eq!(
        resolve_anchor(DIFF, "src/a.ts", "const gone = 1;").unwrap_err(),
        AnchorMiss::NotFound
    );
    let repeated = "diff --git a/src/a.ts b/src/a.ts\n@@ -0,0 +1,2 @@\n+dup;\n+dup;\n";
    assert_eq!(
        resolve_anchor(repeated, "src/a.ts", "dup;").unwrap_err(),
        AnchorMiss::Ambiguous
    );
}

#[test]
fn the_miss_reasons_are_reported_in_the_npm_spelling() {
    assert_eq!(AnchorMiss::NotFound.as_str(), "not-found");
    assert_eq!(AnchorMiss::Ambiguous.as_str(), "ambiguous");
}
