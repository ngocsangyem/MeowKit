//! The frontmatter and spec reader, held to the documents the kit actually
//! ships: a real `SKILL.md` and a real `workflow.yaml` from this repository, so
//! a crate swap that changed a value would fail here rather than in a verb.
use std::path::{Path, PathBuf};

use super::*;

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("..").join("..")
}

#[test]
fn a_block_and_a_body_are_separated_at_the_closing_fence() {
    let (block, body) =
        split_frontmatter("---\nname: mk:plan\n---\n# Heading\n\nText\n").expect("frontmatter");
    assert_eq!(block, "name: mk:plan");
    assert_eq!(body, "# Heading\n\nText\n");
}

#[test]
fn a_crlf_document_and_a_bom_are_read_the_same_way() {
    for source in [
        "---\r\nname: mk:plan\r\n---\r\nBody\r\n",
        "\u{feff}---\nname: mk:plan\n---\nBody\n",
    ] {
        let parsed = parse_frontmatter(source).expect("frontmatter");
        assert_eq!(parsed.string("name"), Some("mk:plan"), "{source:?}");
        assert_eq!(parsed.body, "Body");
    }
}

#[test]
fn a_document_with_no_fence_is_reported_rather_than_guessed_at() {
    assert!(split_frontmatter("# Heading\n").is_none());
    assert!(matches!(
        parse_frontmatter("# Heading\n"),
        Err(YamlError::MissingFrontmatter)
    ));
}

#[test]
fn a_fence_inside_the_body_does_not_close_the_block() {
    let parsed =
        parse_frontmatter("---\nname: x\n---\nbody\n\n---\n\nmore\n").expect("frontmatter");
    assert_eq!(parsed.string("name"), Some("x"));
    assert!(parsed.body.contains("more"));
}

#[test]
fn an_empty_block_is_a_null_document_rather_than_an_error() {
    let parsed = parse_frontmatter("---\n---\nbody\n").expect("frontmatter");
    assert!(parsed.data.is_null());
    assert!(parsed.map().is_none());
}

#[test]
fn nested_maps_lists_and_scalar_types_survive_the_round_trip() {
    let parsed = parse_frontmatter(
        "---\nname: mk:cook\nversion: 1.2\ncount: 3\nuser-invocable: true\ntools:\n  - Bash\n  - Read\nmeowkit:\n  portability: universal\n---\nbody\n",
    )
    .expect("frontmatter");
    let data = parsed.map().expect("a map");
    assert_eq!(data["name"], serde_json::json!("mk:cook"));
    assert_eq!(data["count"], serde_json::json!(3));
    assert_eq!(data["user-invocable"], serde_json::json!(true));
    assert_eq!(data["tools"], serde_json::json!(["Bash", "Read"]));
    assert_eq!(
        data["meowkit"]["portability"],
        serde_json::json!("universal")
    );
    assert!(
        data["version"]
            .as_f64()
            .is_some_and(|v| (v - 1.2).abs() < 1e-9)
    );
}

#[test]
fn invalid_yaml_is_an_error_carrying_the_readers_own_words() {
    let error = parse_frontmatter("---\nname: [unclosed\n---\nbody\n").expect_err("invalid YAML");
    assert!(matches!(error, YamlError::Parse(_)));
    assert!(!error.to_string().is_empty());
}

#[derive(serde::Deserialize)]
struct SkillFrontmatter {
    name: String,
    description: String,
}

#[test]
fn a_typed_read_names_the_fields_the_caller_declared() {
    let (parsed, body) = parse_frontmatter_typed::<SkillFrontmatter>(
        "---\nname: mk:plan\ndescription: Plan the work\nextra: ignored\n---\nBody\n",
    )
    .expect("a typed frontmatter");
    assert_eq!(parsed.name, "mk:plan");
    assert_eq!(parsed.description, "Plan the work");
    assert_eq!(body, "Body");
}

#[test]
fn a_shipped_skill_file_parses_to_its_declared_name() {
    let file = repo_root().join(".claude/skills/cook/SKILL.md");
    let source = std::fs::read_to_string(&file).expect("the cook skill");
    let parsed = parse_frontmatter(&source).expect("every SKILL.md has frontmatter");
    let data = parsed.map().expect("frontmatter is a map");
    assert_eq!(data["name"], serde_json::json!("mk:cook"));
    assert!(!parsed.body.is_empty());
}

#[test]
fn the_shipped_workflow_spec_parses_to_a_map_of_phases() {
    let file = repo_root().join(".claude/skills/workflow-orchestrator/workflow.yaml");
    let source = std::fs::read_to_string(&file).expect("the workflow spec");
    let spec = parse_value(&source).expect("workflow.yaml must parse");
    let map = spec.as_object().expect("a map at the top level");
    assert!(!map.is_empty());
}

#[test]
fn a_closing_fence_at_end_of_file_needs_no_trailing_newline() {
    let (frontmatter, body) = split_frontmatter("---\nname: mk:plan\n---").expect("frontmatter");
    assert_eq!(frontmatter, "name: mk:plan");
    assert_eq!(body, "");
}

#[test]
fn a_fence_with_trailing_spaces_is_not_a_fence_at_any_position() {
    // The TypeScript closing fence is `\r?\n---\r?\n?`: no trailing spaces, at
    // end of file or anywhere else. Accepting `---   ` only at EOF made the
    // same document parse differently depending on a final newline.
    assert!(split_frontmatter("---\nname: x\n---   ").is_none());
    assert!(split_frontmatter("---\nname: x\n---   \nbody\n").is_none());
}
