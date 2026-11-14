//! What the npm CLI did, frozen as data.
//!
//! One JSON file per case under `tests/golden/npm/<case-name>.json`, holding the
//! exit code, both streams and every file the run left in the project. Text has
//! the run's temp directories folded to `<project>` (they are random per run and
//! would make every file differ on each recording) and nothing else folded:
//! timestamps, versions and a case's declared redactions are applied at compare
//! time, to this side and the Rust side alike.
use std::path::PathBuf;

use serde_json::Value;

use super::invoke::Run;

pub struct Golden {
    pub run: Run,
    /// `(relative path, text)` for every file the npm CLI left, sorted by path.
    pub tree: Vec<(String, String)>,
}

pub fn golden_path(case: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("golden")
        .join("npm")
        .join(format!("{case}.json"))
}

impl Golden {
    pub fn load(case: &str) -> Self {
        let path = golden_path(case);
        let bytes = std::fs::read(&path).unwrap_or_else(|e| {
            panic!(
                "[{case}] no recorded npm behaviour at {}: {e}. The goldens are frozen — \
                 a new case needs its expected output written by hand into that file",
                path.display()
            )
        });
        let value: Value = serde_json::from_slice(&bytes)
            .unwrap_or_else(|e| panic!("[{case}] {} is not valid JSON: {e}", path.display()));
        let text = |key: &str| {
            value[key]
                .as_str()
                .unwrap_or_else(|| panic!("[{case}] golden field `{key}` is not a string"))
                .to_string()
        };
        let tree = value["files"]
            .as_object()
            .unwrap_or_else(|| panic!("[{case}] golden field `files` is not an object"))
            .iter()
            .map(|(path, body)| {
                let body = body
                    .as_str()
                    .unwrap_or_else(|| panic!("[{case}] golden file {path} is not a string"));
                (path.clone(), body.to_string())
            })
            .collect();
        Self {
            run: Run {
                code: value["exit_code"]
                    .as_i64()
                    .unwrap_or_else(|| panic!("[{case}] golden `exit_code` is not a number"))
                    as i32,
                stdout: text("stdout"),
                stderr: text("stderr"),
            },
            tree,
        }
    }
}
