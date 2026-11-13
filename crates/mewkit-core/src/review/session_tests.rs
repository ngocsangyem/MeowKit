use std::path::Path;

use serde_json::json;

use super::{read_json, read_jsonl, relative, session_dir, str_field, write_json_pretty};

fn native(path: &str) -> String {
    path.replace('/', std::path::MAIN_SEPARATOR_STR)
}

#[test]
fn the_session_dir_sits_under_the_invocation_directory() {
    assert_eq!(
        session_dir(Path::new("/w"), "s1"),
        Path::new("/w/tasks/reviews/s1")
    );
}

#[test]
fn relative_walks_up_and_down_like_node() {
    assert_eq!(
        relative(Path::new("/w"), Path::new("/w/tasks/reviews/s1")),
        native("tasks/reviews/s1")
    );
    assert_eq!(relative(Path::new("/w"), Path::new("/w")), "");
    assert_eq!(
        relative(Path::new("/w/a"), Path::new("/w/b")),
        native("../b")
    );
    assert_eq!(
        relative(Path::new("/w/./a"), Path::new("/w/a/b")),
        native("b")
    );
}

#[test]
fn a_malformed_jsonl_line_does_not_hide_the_lines_before_it() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let file = dir.path().join("evidence.jsonl");
    std::fs::write(&file, "{\"kind\":\"read\"}\nnot json\n{\"kind\":\"x\"}").expect("write");
    let events = read_jsonl(&file);
    assert_eq!(events.len(), 2);
    assert_eq!(str_field(&events[0], "kind"), "read");
}

#[test]
fn an_absent_or_broken_json_file_reads_as_none() {
    let dir = tempfile::tempdir().expect("a temp dir");
    assert!(read_json(&dir.path().join("absent.json")).is_none());
    let broken = dir.path().join("broken.json");
    std::fs::write(&broken, "{").expect("write");
    assert!(read_json(&broken).is_none());
    assert!(read_jsonl(&dir.path().join("absent.jsonl")).is_empty());
}

#[test]
fn a_written_record_is_two_space_indented_and_newline_terminated() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let file = dir.path().join("manifest.json");
    write_json_pretty(&file, &json!({ "a": 1 })).expect("write");
    assert_eq!(
        std::fs::read_to_string(&file).expect("read"),
        "{\n  \"a\": 1\n}\n"
    );
}

#[test]
fn a_missing_string_field_reads_as_empty() {
    assert_eq!(str_field(&json!({ "a": 1 }), "a"), "");
    assert_eq!(str_field(&json!({ "a": "b" }), "a"), "b");
}
