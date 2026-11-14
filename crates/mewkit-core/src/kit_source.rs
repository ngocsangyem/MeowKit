//! Whether a directory is the MeowKit source checkout itself.
//!
//! In that checkout `.claude/` is the authored source of every kit release, not
//! an installed copy, so `init` refuses to install over it and `validate` runs
//! the authoring-coherence suite there. The marker is this CLI's own crate
//! manifest: it is what builds the binary asking the question, so it exists in
//! the source checkout for exactly as long as the question does, and no
//! consumer project carries it.
use std::path::Path;

/// The crate manifest that marks the source checkout, relative to its root.
pub const KIT_SOURCE_MARKER: &str = "crates/mewkit-cli/Cargo.toml";

/// True when `root` holds the `mewkit-cli` crate manifest.
pub fn is_kit_source_checkout(root: &Path) -> bool {
    std::fs::read_to_string(root.join(KIT_SOURCE_MARKER))
        .is_ok_and(|text| text.lines().any(|l| l.trim() == r#"name = "mewkit-cli""#))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_the_mewkit_cli_manifest_marks_the_source_checkout() {
        let dir = tempfile::tempdir().unwrap();
        assert!(!is_kit_source_checkout(dir.path()));

        let manifest = dir.path().join(KIT_SOURCE_MARKER);
        std::fs::create_dir_all(manifest.parent().unwrap()).unwrap();
        std::fs::write(&manifest, "[package]\nname = \"other-cli\"\n").unwrap();
        assert!(!is_kit_source_checkout(dir.path()));

        std::fs::write(&manifest, "[package]\r\nname = \"mewkit-cli\"\r\n").unwrap();
        assert!(is_kit_source_checkout(dir.path()));
    }

    #[test]
    fn this_repository_is_the_source_checkout() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
        assert!(is_kit_source_checkout(&root));
    }
}
