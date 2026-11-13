//! The comparison itself: what must match, and what a case declared may not.
//!
//! Kept beside the builder rather than inside it so the ORDER of the checks is
//! legible — exit code first, then each stream, then the file tree. A failure
//! in the first one is the most informative, and reporting a stdout diff for a
//! command that exited 2 wastes the reader's time.
use std::path::Path;

use super::fixture::snapshot;
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
        ts: &Run,
        rust: &Run,
        ts_project: &Path,
        rust_project: &Path,
    ) {
        let name = self.name;
        assert_eq!(
            ts.code,
            rust.code,
            "[{name}] exit code differs\n--- npm CLI ---\n{}\n--- mewkit-next ---\n{}",
            ts.describe(),
            rust.describe()
        );
        for (stream, ts_text, rust_text, ignored) in [
            (
                "stdout",
                &ts.stdout,
                &rust.stdout,
                self.allows(|k| matches!(k, AllowanceKind::IgnoreStdout)),
            ),
            (
                "stderr",
                &ts.stderr,
                &rust.stderr,
                self.allows(|k| matches!(k, AllowanceKind::IgnoreStderr)),
            ),
        ] {
            if ignored.is_some() {
                continue;
            }
            assert_eq!(
                normaliser.text(ts_text),
                normaliser.text(rust_text),
                "[{name}] {stream} differs"
            );
        }

        let ts_tree = snapshot(ts_project, normaliser);
        let rust_tree = snapshot(rust_project, normaliser);
        assert_eq!(
            ts_tree.paths(),
            rust_tree.paths(),
            "[{name}] the two CLIs wrote different files"
        );
        for (path, ts_bytes) in ts_tree.entries() {
            assert_eq!(
                ts_bytes,
                rust_tree.get(path),
                "[{name}] {path} differs between the two CLIs"
            );
        }
        for path in &self.expected_writes {
            assert!(
                ts_tree.paths().contains(&path.as_str()),
                "[{name}] neither CLI wrote {path}, so this case proved nothing"
            );
        }
        normaliser.assert_every_allowance_applied(name);
    }
}
