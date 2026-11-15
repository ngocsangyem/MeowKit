//! Unit tests for `denied_tokens` — the set must match the JavaScript checker's copy.
use super::*;

/// The JavaScript instruction checker reads its token list from this file; the
/// entries marked `"rust": true` must equal `DENIED_TOKEN_SOURCES`, or the two
/// checkers would disagree about what is host-foreign.
#[test]
fn denied_tokens_equal_the_javascript_list() {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../scripts/lib/host-foreign-tokens.json");
    let text = std::fs::read_to_string(&path).expect("the shared token list");
    let parsed: serde_json::Value = serde_json::from_str(&text).expect("valid JSON");
    let shared: Vec<(String, String, bool)> = parsed["tokens"]
        .as_array()
        .expect("a tokens array")
        .iter()
        .filter(|t| t["rust"].as_bool() == Some(true))
        .map(|t| {
            (
                t["label"].as_str().expect("label").to_owned(),
                t["pattern"].as_str().expect("pattern").to_owned(),
                t["caseInsensitive"].as_bool().expect("caseInsensitive"),
            )
        })
        .collect();
    let rust: Vec<(String, String, bool)> = DENIED_TOKEN_SOURCES
        .iter()
        .map(|(l, p, ci)| ((*l).to_owned(), (*p).to_owned(), *ci))
        .collect();
    assert_eq!(rust, shared);
}

#[test]
fn denied_tokens_flag_subagent_type_and_todowrite() {
    let hits = scan_denied_tokens("Agent(subagent_type: \"x\") then TodoWrite");
    assert!(hits.contains(&"subagent_type parameter"));
    assert!(hits.contains(&"TodoWrite tool"));
}
