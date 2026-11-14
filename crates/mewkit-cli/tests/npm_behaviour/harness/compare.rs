//! The comparison itself: what must match, and what a case declared may not.
//!
//! Kept beside the builder rather than inside it so the ORDER of the checks is
//! legible — exit code first, then each stream, then the file tree. A failure
//! in the first one is the most informative, and reporting a stdout diff for a
//! command that exited 2 wastes the reader's time.
use std::path::Path;

use super::fixture::{frozen_tree, snapshot};
use super::golden::Golden;
use super::invoke::Run;
use super::normalise::Normaliser;
use super::{AllowanceKind, Case};

impl Case {
    pub(super) fn allows(&self, kind: fn(&AllowanceKind) -> bool) -> Option<&'static str> {
        self.allowances
            .iter()
            .find(|a| kind(&a.kind))
            .map(|a| a.reason)
    }

    pub(super) fn compare(
        &self,
        normaliser: &mut Normaliser,
        npm: &Golden,
        rust: &Run,
        rust_project: &Path,
    ) {
        let name = self.name.as_str();
        let frozen = &npm.run;
        assert_eq!(
            frozen.code,
            rust.code,
            "[{name}] exit code differs\n--- npm CLI (recorded) ---\n{}\n--- mewkit ---\n{}",
            frozen.describe(),
            rust.describe()
        );
        for (stream, npm_text, rust_text, ignored) in [
            (
                "stdout",
                &frozen.stdout,
                &rust.stdout,
                self.allows(|k| matches!(k, AllowanceKind::IgnoreStdout)),
            ),
            (
                "stderr",
                &frozen.stderr,
                &rust.stderr,
                self.allows(|k| matches!(k, AllowanceKind::IgnoreStderr)),
            ),
        ] {
            if ignored.is_some() {
                continue;
            }
            assert_eq!(
                normaliser.text(npm_text),
                normaliser.text(rust_text),
                "[{name}] {stream} differs from the recorded npm output"
            );
        }

        let npm_tree = frozen_tree(&npm.tree, normaliser);
        let rust_tree = snapshot(rust_project, normaliser);
        assert_eq!(
            npm_tree.paths(),
            rust_tree.paths(),
            "[{name}] mewkit wrote different files from the recorded npm run"
        );
        for (path, npm_bytes) in npm_tree.entries() {
            assert_eq!(
                npm_bytes,
                rust_tree.get(path),
                "[{name}] {path} differs from the recorded npm run"
            );
        }
        for path in &self.expected_writes {
            let path = normaliser.path(path);
            assert!(
                npm_tree.paths().contains(&path.as_str()),
                "[{name}] the recorded run did not write {path}, so this case proved nothing"
            );
        }
        normaliser.assert_every_allowance_applied(name);
    }
}
