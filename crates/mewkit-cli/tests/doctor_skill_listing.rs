//! `mewkit doctor`'s per-runtime skill listing rows: size against the
//! documented budget for a 200K and a 1M window, the skills that would lose a
//! description, and `unknown` where a vendor documents no budget. The rows
//! are advisory, so none of them may fail a run.
mod support;

use serde_json::Value;
use support::temp_home::{TempHome, installed};
use support::{code, text};

fn listing_rows(env: &TempHome, targets: &str) -> Vec<Value> {
    let out = env.mewkit(&["doctor", "--json", "--target", targets]);
    assert_eq!(code(&out), 0, "doctor exits 0 on warnings: {}", text(&out));
    serde_json::from_slice::<Value>(&out.stdout)
        .unwrap_or_else(|e| panic!("{e}: {}", text(&out)))
        .as_array()
        .expect("an array of rows")
        .iter()
        .filter(|r| {
            r["name"]
                .as_str()
                .is_some_and(|n| n.starts_with("skill listing: "))
        })
        .cloned()
        .collect()
}

#[test]
fn the_kit_listing_is_reported_against_both_windows_for_claude_code_and_codex() {
    let env = installed("claude-code,codex");
    let rows = listing_rows(&env, "claude-code,codex");
    assert_eq!(rows.len(), 2, "{rows:#?}");
    for row in &rows {
        let detail = row["detail"].as_str().expect("detail");
        assert_ne!(row["status"], "fail", "{row}");
        assert!(detail.contains("tokens est."), "{detail}");
        assert!(detail.contains("200K:"), "{detail}");
        assert!(detail.contains("1M:"), "{detail}");
    }
    let claude = rows[0]["detail"].as_str().expect("detail");
    assert!(claude.contains("1% of the window"), "{claude}");
    assert_eq!(
        rows[0]["status"], "warn",
        "the full kit is over 1% of 200K: {claude}"
    );
    assert!(claude.contains("would lose their description"), "{claude}");
    let codex = rows[1]["detail"].as_str().expect("detail");
    assert!(codex.contains("2% of the window"), "{codex}");
}

#[test]
fn a_runtime_with_no_documented_budget_is_reported_unknown_without_a_warning() {
    let env = installed("cursor");
    let rows = listing_rows(&env, "cursor");
    assert_eq!(rows.len(), 1, "{rows:#?}");
    assert_eq!(rows[0]["status"], "ok");
    let detail = rows[0]["detail"].as_str().expect("detail");
    assert!(detail.contains("budget unknown"), "{detail}");
}
