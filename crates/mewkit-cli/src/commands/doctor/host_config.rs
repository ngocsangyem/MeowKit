//! Reading a host's own configuration file without trusting it to be one.
//!
//! `doctor` reaches these paths — `~/.claude/settings.json`, `.codex/config.toml`
//! — for every runtime at every scope, whether or not anything was installed
//! there. So it opens files whose contents, size and very nature are entirely
//! outside this project's control, which makes "read the file" the wrong
//! primitive and this module the right one.
use std::io::Read;
use std::path::Path;

/// Bytes read from one host configuration file. Larger than any real settings
/// or hook file; more than this is reported as unreadable rather than streamed.
const MAX_CONFIG: u64 = 1024 * 1024;

/// What a bounded read of a host configuration file found.
pub enum ConfigRead {
    /// The file's text, within the cap.
    Text(String),
    /// Nothing is there, which for an optional configuration file is no finding
    /// at all.
    Absent,
    /// Something is there that must not be read as a configuration file: a
    /// named pipe, a device, a directory, or more bytes than the cap allows.
    Unusable,
}

impl ConfigRead {
    pub fn text(self) -> Option<String> {
        match self {
            Self::Text(text) => Some(text),
            _ => None,
        }
    }
}

/// One host configuration file, read under a cap.
///
/// Three properties here each stand for a way this went wrong before.
///
/// The link IS followed, because a settings file in a dotfile repository is
/// normally a symlink and refusing those would report every such machine as
/// having no hooks — so `metadata`, not `symlink_metadata`. (Inside a scanned
/// tree the opposite holds, and that is why the scan there does not follow
/// one: the caller chose the directory, not what someone put in it.)
///
/// The `is_file` check behind it is what keeps a named pipe, a device or a
/// directory from being opened at all. A FIFO where `~/.claude/settings.json`
/// belongs blocks the first process to open it, so `doctor` would hang with no
/// output and nothing to say why.
///
/// And the size comes from the handle's own capped read rather than from the
/// metadata, because the two can disagree: the file may grow between the two
/// calls, and a check on the metadata would then have passed a file the read
/// never finishes.
pub fn config_text(file: &Path) -> ConfigRead {
    match std::fs::metadata(file) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return ConfigRead::Absent,
        Err(_) => return ConfigRead::Unusable,
        Ok(meta) if !meta.is_file() => return ConfigRead::Unusable,
        Ok(_) => {}
    }
    let mut bytes = Vec::new();
    let read = std::fs::File::open(file)
        .ok()
        .and_then(|f| f.take(MAX_CONFIG + 1).read_to_end(&mut bytes).ok());
    match read {
        Some(_) if bytes.len() as u64 <= MAX_CONFIG => {
            ConfigRead::Text(String::from_utf8_lossy(&bytes).into_owned())
        }
        _ => ConfigRead::Unusable,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A configuration file that is not a plain file of a sane size is reported
    /// as unusable rather than opened: opening a FIFO never returns.
    #[test]
    fn a_config_read_separates_absent_from_unusable() {
        let dir = tempfile::tempdir().expect("a temporary directory");
        assert!(matches!(
            config_text(&dir.path().join("none.json")),
            ConfigRead::Absent
        ));
        // A directory wearing a settings file's name.
        assert!(matches!(config_text(dir.path()), ConfigRead::Unusable));
        let big = dir.path().join("big.json");
        std::fs::write(
            &big,
            vec![b'x'; usize::try_from(MAX_CONFIG).expect("cap") + 1],
        )
        .expect("write");
        assert!(matches!(config_text(&big), ConfigRead::Unusable));
        let small = dir.path().join("small.json");
        std::fs::write(&small, "{}").expect("write");
        assert_eq!(config_text(&small).text().as_deref(), Some("{}"));
    }
}
