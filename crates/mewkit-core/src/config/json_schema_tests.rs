//! Pure mapping tests. The committed-file comparison lives in the
//! `config_schema` integration test so CI runs it as a named target.
use super::*;

#[test]
fn every_key_the_validator_knows_is_a_property() {
    let names = vec!["post-write".to_string()];
    let schema = config_json_schema(&names);
    let props = &schema["properties"];
    assert_eq!(props["tdd"]["type"], "boolean");
    assert_eq!(props["budget"]["properties"]["cap"]["type"], "integer");
    assert_eq!(
        props["hooks"]["properties"]["post-write"]["type"],
        "boolean"
    );
    assert_eq!(props["hooks"]["additionalProperties"], false);
    assert!(props.get("gates").is_none() && props.get("paths").is_none());
}
