//! Node's `path.join` for RELATIVE segments, so a path the npm CLI builds and
//! prints reads the same from the Rust CLI: `.` and empty segments drop, `..`
//! pops (or stays, when nothing is left to pop), and the platform separator
//! joins. On Windows both `/` and `\` separate, as they do in `path.win32`.
use std::path::MAIN_SEPARATOR_STR;

pub fn join_relative(segments: &[&str]) -> String {
    let mut parts: Vec<&str> = Vec::new();
    for segment in segments {
        for part in segment.split(is_separator) {
            match part {
                "" | "." => {}
                ".." if parts.last().is_some_and(|last| *last != "..") => {
                    parts.pop();
                }
                other => parts.push(other),
            }
        }
    }
    if parts.is_empty() {
        return ".".to_string();
    }
    parts.join(MAIN_SEPARATOR_STR)
}

fn is_separator(c: char) -> bool {
    c == '/' || (cfg!(windows) && c == '\\')
}

#[cfg(test)]
mod tests {
    use super::join_relative;

    fn native(path: &str) -> String {
        path.replace('/', super::MAIN_SEPARATOR_STR)
    }

    #[test]
    fn joins_and_normalises_like_node() {
        assert_eq!(
            join_relative(&["tasks", "reviews", "a-verdict.json"]),
            native("tasks/reviews/a-verdict.json")
        );
        assert_eq!(
            join_relative(&["tasks", "reviews", "x/../b-verdict.json"]),
            native("tasks/reviews/b-verdict.json")
        );
        assert_eq!(
            join_relative(&["tasks", "reviews", "../../../c"]),
            native("../c")
        );
        assert_eq!(
            join_relative(&["tasks", "./reviews//", "d"]),
            native("tasks/reviews/d")
        );
        assert_eq!(join_relative(&["a", ".."]), ".");
    }
}
