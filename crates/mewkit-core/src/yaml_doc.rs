//! The general YAML reader: frontmatter in markdown, and spec files such as
//! `workflow.yaml`.
//!
//! This is the OTHER YAML in the kit, and it is deliberately not the config
//! reader. A skill's frontmatter and a workflow spec are authored documents that
//! may use the whole language, and nothing parses them twice — so a library is
//! the right answer here, where the config's two-reader constraint made a hand
//! parser the right answer there ([`crate::config::yaml_grammar`]).
//!
//! One crate, pinned: `serde-saphyr`. It is pure Rust, actively released, and
//! carries no RustSec advisory — unlike `serde_yaml` (deprecated since 0.9.34),
//! `serde_yml` (RUSTSEC-2025-0068, unsound and unmaintained) and `yaml-rust`
//! (RUSTSEC-2024-0320). `cargo deny` fails CI on any advisory, so an
//! unmaintained reader is not a choice this workspace can make.
//!
//! Documents are DATA. A frontmatter block is authored content: this module
//! returns values and never acts on them.
use serde::de::DeserializeOwned;

/// `---\n … \n---` at the very start of the file, the only place frontmatter is
/// recognised, matching the `^---\r?\n([\s\S]*?)\r?\n---\r?\n?` the TypeScript
/// readers use.
const FENCE: &str = "---";

#[derive(Debug, thiserror::Error)]
pub enum YamlError {
    #[error("no YAML frontmatter")]
    MissingFrontmatter,
    #[error("{0}")]
    Parse(String),
}

/// A markdown document split in two.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Frontmatter {
    /// The parsed block. A map in every document the kit writes, but any YAML
    /// value is representable, so the caller decides what "not an object" means.
    pub data: serde_json::Value,
    /// Everything after the closing fence, trimmed, as the TypeScript readers
    /// return it.
    pub body: String,
}

impl Frontmatter {
    /// The block as a map, or `None` when the document's frontmatter is a
    /// scalar or a list — which is what "frontmatter is not an object" means.
    pub fn map(&self) -> Option<&serde_json::Map<String, serde_json::Value>> {
        self.data.as_object()
    }

    /// One top-level string field, absent when the key is missing or not a
    /// string.
    pub fn string(&self, key: &str) -> Option<&str> {
        self.data.get(key)?.as_str()
    }
}

/// Strip a BOM, which an editor on Windows may have written.
fn without_bom(source: &str) -> &str {
    source.strip_prefix('\u{feff}').unwrap_or(source)
}

/// The frontmatter block and the body, or `None` when the document opens with
/// something other than a fence.
pub fn split_frontmatter(source: &str) -> Option<(&str, &str)> {
    let text = without_bom(source);
    let after_open = text
        .strip_prefix(&format!("{FENCE}\n"))
        .or_else(|| text.strip_prefix(&format!("{FENCE}\r\n")))?;
    // The closing fence is a line of its own: a `---` inside a scalar is not it.
    let mut offset = 0usize;
    for line in after_open.split_inclusive('\n') {
        if line.trim_end_matches(['\r', '\n']) == FENCE {
            return Some((
                after_open[..offset].trim_end_matches(['\n', '\r']),
                &after_open[offset + line.len()..],
            ));
        }
        offset += line.len();
    }
    // No trailing-newline special case: `split_inclusive` yields the final
    // segment whether or not it ends in `\n`, so a closing `---` at end of file
    // already returns above. The branch that used to be here also accepted
    // `---   ` via `trim_end()`, which the TypeScript
    // (`\r?\n---\r?\n?`) does not — more lenient at EOF than one line earlier.
    None
}

/// Parse one YAML document into an untyped value.
pub fn parse_value(yaml: &str) -> Result<serde_json::Value, YamlError> {
    if yaml.trim().is_empty() {
        return Ok(serde_json::Value::Null);
    }
    serde_saphyr::from_str::<serde_json::Value>(yaml)
        .map_err(|err| YamlError::Parse(err.to_string()))
}

/// Parse one YAML document into a type the caller declares.
pub fn parse_typed<T: DeserializeOwned>(yaml: &str) -> Result<T, YamlError> {
    serde_saphyr::from_str::<T>(yaml).map_err(|err| YamlError::Parse(err.to_string()))
}

/// The frontmatter of a markdown document, untyped.
pub fn parse_frontmatter(source: &str) -> Result<Frontmatter, YamlError> {
    let Some((block, body)) = split_frontmatter(source) else {
        return Err(YamlError::MissingFrontmatter);
    };
    Ok(Frontmatter {
        data: parse_value(block)?,
        body: body.trim().to_string(),
    })
}

/// The frontmatter of a markdown document as a declared type, with the body.
pub fn parse_frontmatter_typed<T: DeserializeOwned>(
    source: &str,
) -> Result<(T, String), YamlError> {
    let Some((block, body)) = split_frontmatter(source) else {
        return Err(YamlError::MissingFrontmatter);
    };
    Ok((parse_typed::<T>(block)?, body.trim().to_string()))
}

#[cfg(test)]
#[path = "yaml_doc_tests.rs"]
mod yaml_doc_tests;
