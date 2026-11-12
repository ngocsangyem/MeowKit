//! Lexical predicates about the SHAPE of a path string.
//!
//! One home for both, because they are the same judgement from two directions
//! and the kit already shipped a weaker second copy of it: the capability
//! manifest checked only `starts_with('/')` and split on `/`, so `C:\x` and
//! `a\..\..\b` were accepted as contained — real escapes on Windows, in a CLI
//! whose own plan names Windows paths as a standing risk.
//!
//! Lexical by design: neither predicate touches the filesystem, so a symlink at
//! a contained path is NOT detected here. A caller that needs the answer to
//! survive one resolves the path first.

/// POSIX `/etc/x` and Windows `C:\x` or `C:/x`. A machine-specific path is not
/// shareable, and an absolute path is never contained in a relative root.
///
/// Ports `^(\/|[A-Za-z]:[\\/])` from `config/config-rules.ts` and the same
/// prefix test in `core/validate-capabilities.ts`.
pub fn is_absolute_path(text: &str) -> bool {
    if text.starts_with('/') {
        return true;
    }
    let mut chars = text.chars();
    matches!(
        (chars.next(), chars.next(), chars.next()),
        (Some(drive), Some(':'), Some('\\' | '/')) if drive.is_ascii_alphabetic()
    )
}

/// True when `rel` is a relative path with no escape: not absolute, and no
/// component is `..` under EITHER separator.
///
/// Ports `isContained` in `core/validate-capabilities.ts`
/// (`rel.split(/[\\/]/).includes("..")`). Both separators are checked because a
/// backslash is a separator on Windows and a legal filename character on POSIX
/// — reading it as a separator in both places refuses more, never less.
pub fn is_contained_relative(rel: &str) -> bool {
    !is_absolute_path(rel) && !rel.split(['\\', '/']).any(|segment| segment == "..")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_absolute_path_is_recognised_under_both_conventions() {
        assert!(is_absolute_path("/etc/passwd"));
        assert!(is_absolute_path("C:\\Users\\dev"));
        assert!(is_absolute_path("c:/Users/dev"));
        assert!(!is_absolute_path("skills/cook/SKILL.md"));
        assert!(!is_absolute_path("C:relative"));
        assert!(!is_absolute_path("1:/not-a-drive"));
        assert!(!is_absolute_path(""));
    }

    #[test]
    fn containment_refuses_every_escape_the_typescript_refuses() {
        assert!(is_contained_relative("skills/cook/SKILL.md"));
        assert!(is_contained_relative("hooks/lib/gate2-check.cjs"));
        // Names that merely CONTAIN dots are not escapes.
        assert!(is_contained_relative("rules/..rules.md"));
        assert!(is_contained_relative("a/.../b"));

        assert!(!is_contained_relative("/etc/passwd"));
        assert!(!is_contained_relative("../outside"));
        assert!(!is_contained_relative("a/../../b"));
        // The three cases the weaker predicate let through.
        assert!(!is_contained_relative("..\\x"));
        assert!(!is_contained_relative("a\\..\\..\\b"));
        assert!(!is_contained_relative("C:\\x"));
    }
}
