use super::{FileKind, derive_impact_from_diff, enrich_with_searches};

const DELETED_EXPORT: &str = "diff --git a/src/api.ts b/src/api.ts\n\
     deleted file mode 100644\n\
     --- a/src/api.ts\n\
     +++ /dev/null\n\
     @@\n\
     -export const getUser = 1;\n";

#[test]
fn a_deleted_export_breaking_a_caller_escalates_to_a_scout_pass() {
    let map = derive_impact_from_diff(DELETED_EXPORT);
    assert!(!map.removed_or_renamed.is_empty());
    assert!(map.scout_required);
    assert!(
        map.scout_reasons
            .contains(&"public symbol / file / config removed or renamed".to_string())
    );
    assert_eq!(map.search_terms, ["getUser"]);
}

#[test]
fn a_deleted_export_plus_a_new_util_cites_both() {
    let diff = [
        "diff --git a/src/api/old.ts b/src/api/old.ts",
        "deleted file mode 100644",
        "--- a/src/api/old.ts",
        "+++ /dev/null",
        "@@",
        "-export function gone() {}",
        "diff --git a/src/lib/new-util.ts b/src/lib/new-util.ts",
        "--- a/src/lib/new-util.ts",
        "+++ b/src/lib/new-util.ts",
        "@@ -0,0 +1,1 @@",
        "+export function helper() {}",
    ]
    .join("\n");
    let map = derive_impact_from_diff(&diff);
    assert!(map.scout_required);
    assert!(map.risk_flags.contains(&"ABSTRACTION".to_string()));
    assert!(map.search_terms.contains(&"helper".to_string()));
    assert_eq!(map.production_dirs, ["src/api", "src/lib"]);
}

#[test]
fn docs_and_lockfile_churn_never_requires_a_scout() {
    let diff = "diff --git a/docs/a.md b/docs/a.md\n\
         --- a/docs/a.md\n\
         +++ b/docs/a.md\n\
         @@\n\
         +a password appears here\n";
    let map = derive_impact_from_diff(diff);
    // The AUTH flag still RAISES (the content matched) — it just cannot force
    // a scout pass when nothing outside docs changed.
    assert!(map.risk_flags.contains(&"AUTH".to_string()));
    assert!(!map.scout_required);
    assert_eq!(map.stats.source_changed, 0);
    assert_eq!(map.stats.total_changed, 1);
}

#[test]
fn an_empty_diff_yields_an_empty_map() {
    let map = derive_impact_from_diff("");
    assert!(map.changed_files.is_empty());
    assert!(!map.scout_required);
    assert_eq!(map.stats.total_changed, 0);
}

#[test]
fn a_rename_is_recorded_against_the_old_path() {
    let diff = "diff --git a/src/a.ts b/src/b.ts\n\
         rename from src/a.ts\n\
         rename to src/b.ts\n\
         @@\n\
         +const x = 1;\n";
    let map = derive_impact_from_diff(diff);
    assert_eq!(
        map.changed_files[0].renamed_from.as_deref(),
        Some("src/a.ts")
    );
    assert_eq!(map.removed_or_renamed[0].file, "src/a.ts");
    assert_eq!(map.removed_or_renamed[0].symbol, "<renamed → src/b.ts>");
}

#[test]
fn a_deleted_config_file_is_a_contract_change_too() {
    let diff = "diff --git a/app.yaml b/app.yaml\n\
         deleted file mode 100644\n\
         --- a/app.yaml\n\
         +++ /dev/null\n\
         @@\n\
         -key: 1\n";
    let map = derive_impact_from_diff(diff);
    assert_eq!(map.changed_files[0].kind, FileKind::Config);
    assert_eq!(map.removed_or_renamed[0].symbol, "<config/file deleted>");
    assert!(map.scout_required);
}

#[test]
fn the_serialized_map_keeps_the_npm_field_order() {
    let map = enrich_with_searches(derive_impact_from_diff(DELETED_EXPORT), |_| {
        vec!["src/caller.ts:4".to_string()]
    });
    let text = serde_json::to_string(&map).expect("serialize");
    let keys: Vec<&str> = [
        "changedFiles",
        "changedExports",
        "removedOrRenamed",
        "configKeys",
        "productionDirs",
        "riskFlags",
        "searchTerms",
        "scoutRequired",
        "scoutReasons",
        "stats",
        "callers",
    ]
    .into_iter()
    .collect();
    let mut at = 0;
    for key in keys {
        let found = text[at..]
            .find(&format!("\"{key}\""))
            .unwrap_or_else(|| panic!("{key} is missing or out of order in {text}"));
        at += found;
    }
    // A changed file serializes its counters before the rename it may carry.
    assert!(
        text.contains(
            r#""path":"src/api.ts","kind":"source","deleted":true,"added":0,"removed":1"#
        )
    );
    assert!(text.contains(r#""callers":[{"term":"getUser","hits":["src/caller.ts:4"]}]"#));
}

#[test]
fn searches_are_attached_for_every_term() {
    let map = enrich_with_searches(derive_impact_from_diff(DELETED_EXPORT), |_| Vec::new());
    let callers = map.callers.expect("callers are always attached");
    assert_eq!(callers.len(), 1);
    assert!(callers[0].hits.is_empty());
}
