//! A job's output log, capped: when `log` passes half the cap it becomes
//! `log.1` (replacing the older one), so a runaway command keeps at most the
//! cap on disk. Reading back to an agent goes through the secret scrubber.
use std::fs::{File, OpenOptions};
use std::io::{self, Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

/// Total bytes a job keeps across `log` and `log.1`.
pub const LOG_CAP: u64 = 2 * 1024 * 1024;

pub struct CappedLog {
    path: PathBuf,
    file: File,
    written: u64,
}

fn open_append(path: &Path) -> io::Result<File> {
    let mut options = OpenOptions::new();
    options.create(true).append(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    options.open(path)
}

impl CappedLog {
    pub fn open(path: &Path) -> io::Result<Self> {
        let file = open_append(path)?;
        let written = file.metadata().map(|m| m.len()).unwrap_or(0);
        Ok(Self {
            path: path.to_path_buf(),
            file,
            written,
        })
    }

    pub fn write(&mut self, bytes: &[u8]) -> io::Result<()> {
        if self.written + bytes.len() as u64 > LOG_CAP / 2 {
            let rotated = self.path.with_extension("1");
            let _ = std::fs::remove_file(&rotated);
            std::fs::rename(&self.path, &rotated)?;
            self.file = open_append(&self.path)?;
            self.written = 0;
        }
        self.file.write_all(bytes)?;
        self.written += bytes.len() as u64;
        Ok(())
    }
}

/// Bytes of `path` from `offset` on, and the offset to read from next. A
/// file shorter than `offset` was rotated: read it from the start.
pub fn read_from(path: &Path, offset: u64) -> (Vec<u8>, u64) {
    let Ok(mut file) = File::open(path) else {
        return (Vec::new(), offset);
    };
    let len = file.metadata().map(|m| m.len()).unwrap_or(0);
    let start = if len < offset { 0 } else { offset };
    let mut buf = Vec::new();
    if file.seek(SeekFrom::Start(start)).is_ok() {
        let _ = file.take(LOG_CAP).read_to_end(&mut buf);
    }
    let next = start + buf.len() as u64;
    (buf, next)
}

/// Text safe to show an agent: lossy UTF-8 with secret-shaped tokens masked.
pub fn redact(bytes: &[u8]) -> String {
    crate::memory::scrub_secrets(&String::from_utf8_lossy(bytes))
}

/// The last `max` bytes of the job's log, rotated part included, redacted.
pub fn tail(path: &Path, max: usize) -> String {
    let mut all = std::fs::read(path.with_extension("1")).unwrap_or_default();
    all.extend(std::fs::read(path).unwrap_or_default());
    let from = all.len().saturating_sub(max);
    redact(&all[from..])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_log_rotates_at_half_the_cap_and_tail_reads_both_parts() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("log");
        let mut log = CappedLog::open(&path).unwrap();
        let chunk = vec![b'a'; (LOG_CAP / 4) as usize];
        for _ in 0..5 {
            log.write(&chunk).unwrap();
        }
        log.write(b"end\n").unwrap();
        let total = std::fs::metadata(&path).unwrap().len()
            + std::fs::metadata(path.with_extension("1")).unwrap().len();
        assert!(total <= LOG_CAP);
        assert!(tail(&path, 10).ends_with("end\n"));
        let (bytes, next) = read_from(&path, 0);
        assert_eq!(next, bytes.len() as u64);
        let (_, after_rotation) = read_from(&path, u64::MAX);
        assert_eq!(after_rotation, next);
    }
}
