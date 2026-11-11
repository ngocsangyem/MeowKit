use super::HookLayout::Grouped as G;
use super::*;
use serde_json::json;

fn h(matcher: Option<&str>, cmd: &str) -> Handler {
    Handler {
        matcher: matcher.map(str::to_owned),
        handler: json!({"type": "command", "command": cmd}),
    }
}

fn ids(hs: &[Handler]) -> Vec<String> {
    hs.iter().map(|x| x.id().unwrap()).collect()
}

#[test]
fn joins_the_users_group_with_the_same_matcher_and_strips_back() {
    let user = render(&json!({"hooks": {"PreToolUse": [
        {"matcher": "Bash", "hooks": [{"type": "command", "command": "mine"}]}
    ]}, "other": 1}));
    let kit = [
        h(Some("Bash"), "kit-a"),
        h(Some("Edit"), "kit-b"),
        h(None, "kit-c"),
    ];
    let out = merge(&user, "PreToolUse", &kit, G).unwrap();
    assert_eq!(out.created, 0);
    let v: Value = serde_json::from_str(&out.text).unwrap();
    let groups = v["hooks"]["PreToolUse"].as_array().unwrap();
    assert_eq!(groups.len(), 3);
    assert_eq!(groups[0]["hooks"].as_array().unwrap().len(), 2);
    assert!(groups[2].get("matcher").is_none());
    assert_eq!(
        strip(&out.text, "PreToolUse", &ids(&kit), 0, G).unwrap(),
        user
    );
}

#[test]
fn removes_only_the_containers_it_created() {
    for (user, created) in [("", 2), ("{\n  \"hooks\": {}\n}\n", 1)] {
        let kit = [h(Some("Bash"), "k")];
        let out = merge(user, "Stop", &kit, G).unwrap();
        assert_eq!(out.created, created);
        let back = strip(&out.text, "Stop", &ids(&kit), out.created, G).unwrap();
        let want = if user.is_empty() { "{}\n" } else { user };
        assert_eq!(back, want);
    }
}

#[test]
fn re_merge_is_idempotent_and_reports_replaced_user_handlers() {
    let kit = [h(Some("Bash"), "k")];
    let once = merge("", "PreToolUse", &kit, G).unwrap();
    let twice = merge(&once.text, "PreToolUse", &kit, G).unwrap();
    assert_eq!(once.text, twice.text);
    assert!(twice.replaced.is_empty());

    let mut changed = kit[0].clone();
    changed.handler["timeout"] = json!(5);
    let out = merge(&once.text, "PreToolUse", &[changed], G).unwrap();
    assert_eq!(out.replaced, ids(&kit));
}

#[test]
fn nothing_to_strip_leaves_text_byte_identical() {
    let tabbed = "{\n\t\"hooks\": {\"Stop\": []}\n}\n";
    assert_eq!(
        strip(tabbed, "Stop", &ids(&[h(None, "x")]), 0, G).unwrap(),
        tabbed
    );
    assert_eq!(
        strip(tabbed, "PreToolUse", &ids(&[h(None, "x")]), 0, G).unwrap(),
        tabbed
    );
}

#[test]
fn handlers_that_differ_only_in_args_stay_distinct() {
    let with = |arg: &str| Handler {
        matcher: Some("Edit".into()),
        handler: json!({"type": "command", "command": "node", "args": [arg]}),
    };
    let kit = [with("a.cjs"), with("b.cjs")];
    let out = merge("", "PreToolUse", &kit, G).unwrap();
    let v: Value = serde_json::from_str(&out.text).unwrap();
    assert_eq!(
        v["hooks"]["PreToolUse"][0]["hooks"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    let back = strip(&out.text, "PreToolUse", &ids(&kit[..1]), out.created, G).unwrap();
    let v: Value = serde_json::from_str(&back).unwrap();
    assert_eq!(v["hooks"]["PreToolUse"][0]["hooks"][0]["args"][0], "b.cjs");
}

#[test]
fn kit_created_containers_go_even_if_the_handlers_were_removed_by_hand() {
    let kit = [h(Some("Bash"), "k")];
    let out = merge("", "Stop", &kit, G).unwrap();
    let by_hand = out
        .text
        .replace(
            r#"{
            "type": "command",
            "command": "k"
          }"#,
            "",
        )
        .replace("[\n          \n        ]", "[]");
    let v: Value = serde_json::from_str(&by_hand).unwrap();
    assert!(
        v["hooks"]["Stop"][0]["hooks"]
            .as_array()
            .unwrap()
            .is_empty(),
        "{by_hand}"
    );
    // The user's emptied group is theirs now; the event array is not removed under it.
    let back = strip(&by_hand, "Stop", &ids(&kit), out.created, G).unwrap();
    assert_eq!(back, by_hand);
    assert_eq!(
        strip(
            "{\n  \"hooks\": {\n    \"Stop\": []\n  }\n}\n",
            "Stop",
            &ids(&kit),
            2,
            G
        )
        .unwrap(),
        "{}\n"
    );
}

#[test]
fn a_users_own_empty_group_survives_a_strip() {
    let user = render(&json!({"hooks": {"Stop": [{"matcher": "X", "hooks": []}]}}));
    let kit = [h(Some("Y"), "k")];
    let out = merge(&user, "Stop", &kit, G).unwrap();
    assert_eq!(
        strip(&out.text, "Stop", &ids(&kit), out.created, G).unwrap(),
        user
    );
}

#[test]
fn rejects_malformed_shapes() {
    assert!(merge(r#"{"hooks": []}"#, "Stop", &[h(None, "x")], G).is_err());
    assert!(merge(r#"{"hooks": {"Stop": {}}}"#, "Stop", &[h(None, "x")], G).is_err());
    let bad = Handler {
        matcher: None,
        handler: json!({"type": "command"}),
    };
    assert!(merge("", "Stop", &[bad], G).is_err());
    assert!(merge("", "Stop", &[h(Some(""), "x")], G).is_err());
}

use super::HookLayout::Flat as F;

fn flat(matcher: Option<&str>, cmd: &str) -> Handler {
    let mut v = json!({"command": cmd, "failClosed": true});
    if let Some(m) = matcher {
        v["matcher"] = json!(m);
    }
    Handler {
        matcher: matcher.map(str::to_owned),
        handler: v,
    }
}

#[test]
fn flat_handlers_sit_beside_the_users_and_strip_back() {
    let user = render(&json!({"version": 1, "hooks": {"preToolUse": [
        {"command": "mine"},
        {"matcher": "^edit", "command": "kit-a"}
    ]}}));
    // Same command under another matcher is a different handler.
    let kit = [flat(Some("^read"), "kit-a"), flat(None, "kit-b")];
    let out = merge(&user, "preToolUse", &kit, F).unwrap();
    assert_eq!(out.created, 0);
    let v: Value = serde_json::from_str(&out.text).unwrap();
    assert_eq!(v["hooks"]["preToolUse"].as_array().unwrap().len(), 4);
    assert_eq!(
        strip(&out.text, "preToolUse", &ids(&kit), 0, F).unwrap(),
        user
    );

    let again = merge(&out.text, "preToolUse", &kit, F).unwrap();
    assert_eq!(again.text, out.text);
    assert!(again.replaced.is_empty());
}

#[test]
fn a_flat_strip_of_a_fresh_file_leaves_nothing() {
    let kit = [flat(None, "x"), flat(Some(".*"), "x")];
    let out = merge("", "stop", &kit, F).unwrap();
    assert_eq!(out.created, 2);
    assert_eq!(strip(&out.text, "stop", &ids(&kit), 2, F).unwrap(), "{}\n");
}

#[test]
fn a_flat_handler_must_carry_its_own_matcher() {
    let mut h = flat(Some("^edit"), "x");
    h.matcher = Some("^read".into());
    assert!(merge("", "preToolUse", &[h], F).is_err());
}

#[test]
fn an_identical_user_handler_is_adopted_not_reported_as_already_there() {
    // ADR 261110-rust-adapter-contract: migrating from an npm CLI install needs
    // the kit to take its own handlers back, so hooks never report `already`.
    let kit = [h(None, "x")];
    let once = merge("", "Stop", &kit, G).unwrap();
    assert!(
        merge(&once.text, "Stop", &kit, G)
            .unwrap()
            .already
            .is_empty()
    );
    let flat_kit = [flat(None, "x")];
    let once = merge("", "stop", &flat_kit, F).unwrap();
    assert!(
        merge(&once.text, "stop", &flat_kit, F)
            .unwrap()
            .already
            .is_empty()
    );
}
