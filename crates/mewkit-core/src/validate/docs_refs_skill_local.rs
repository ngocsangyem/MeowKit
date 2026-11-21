//! Backticked `references/…`, `assets/…` and `templates/…` paths inside a skill.
//!
//! A skill names its own files by a path relative to its own directory, in
//! backticks rather than as a markdown link, so the link scan never sees them.
//! A file that was moved or renamed leaves these behind. A path counts as
//! resolved when it exists under the skill's root OR beside the file that
//! names it, because both readings are used in the kit.
use std::path::Path;
use std::sync::LazyLock;

use regex::Regex;

static LOCAL_PATH: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile(r"`((?:references|assets|templates)/[A-Za-z0-9_./\-]+)`")
        .expect("a static skill-local path pattern")
});

/// The skill-local paths on one line that exist neither under `skill_root` nor
/// beside `file_dir`. A trailing `/` names a directory and is checked as one.
pub(super) fn missing_local_paths(skill_root: &Path, file_dir: &Path, line: &str) -> Vec<String> {
    LOCAL_PATH
        .captures_iter(line)
        .map(|caps| caps[1].to_string())
        .filter(|path| {
            let rel = path.trim_end_matches('/');
            !skill_root.join(rel).exists() && !file_dir.join(rel).exists()
        })
        .collect()
}
