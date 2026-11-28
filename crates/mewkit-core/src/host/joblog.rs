//! A job's output log, capped: when `log` passes half the cap it becomes
//! `log.1` (replacing the older one), so a runaway command keeps at most the
//! cap on disk. Each rotation bumps `log.gen`, so a reader following the log
//! knows to finish `log.1` before starting the new `log`. The supervisor
//! writes whole lines through the secret scrubber ([`Lines`]), so the file
//! on disk is redacted, and reading back to an agent scrubs again.
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

fn gen_path(path: &Path) -> PathBuf {
    path.with_extension("gen")
}

/// How many times `path` has rotated (0 before the first).
pub fn generation(path: &Path) -> u64 {
    super::paths::read_parsed(&gen_path(path)).unwrap_or(0)
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
            let next = generation(&self.path) + 1;
            crate::fsx::atomic_write(
                &gen_path(&self.path),
                next.to_string().as_bytes(),
                Some(0o600),
            )?;
        }
        self.file.write_all(bytes)?;
        self.written += bytes.len() as u64;
        Ok(())
    }
}

/// Bytes of `path` from `offset` on, and the offset to read from next.
pub fn read_from(path: &Path, offset: u64) -> (Vec<u8>, u64) {
    let Ok(mut file) = File::open(path) else {
        return (Vec::new(), offset);
    };
    let mut buf = Vec::new();
    if file.seek(SeekFrom::Start(offset)).is_ok() {
        let _ = file.take(LOG_CAP).read_to_end(&mut buf);
    }
    let next = offset + buf.len() as u64;
    (buf, next)
}

/// Where a follower is in a job's log: the rotation it is reading and the
/// offset in that file.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Cursor {
    pub generation: u64,
    pub offset: u64,
}

/// Note put in the stream when the log rotated more than once between two
/// reads, so the output in between is gone.
pub const SKIPPED: &[u8] = b"\n[mewkit host: output skipped while the log rotated]\n";

/// Everything written since `cursor`, across a rotation: the rest of
/// `log.1` first, then the new `log`. A read that raced a rotation is
/// dropped and redone from the rotated file.
pub fn read_new(path: &Path, cursor: &mut Cursor) -> Vec<u8> {
    let before = generation(path);
    if before == cursor.generation {
        let (bytes, next) = read_from(path, cursor.offset);
        if generation(path) == before {
            cursor.offset = next;
            return bytes;
        }
    }
    let now = generation(path);
    let mut out = if now == cursor.generation + 1 {
        read_from(&path.with_extension("1"), cursor.offset).0
    } else {
        SKIPPED.to_vec()
    };
    *cursor = Cursor {
        generation: now,
        offset: 0,
    };
    out.extend(read_new(path, cursor));
    out
}

/// A partial line longer than this is written out unfinished, so output
/// without newlines can never grow a buffer without bound.
pub const MAX_PARTIAL: usize = 64 * 1024;

/// Splits a stream into whole lines and scrubs each before it is stored.
#[derive(Default)]
pub struct Lines {
    pending: Vec<u8>,
}

impl Lines {
    /// The scrubbed whole lines completed by `bytes` (empty while none is).
    pub fn push(&mut self, bytes: &[u8]) -> Vec<u8> {
        self.pending.extend_from_slice(bytes);
        let cut = if self.pending.len() > MAX_PARTIAL {
            self.pending.len()
        } else {
            self.pending
                .iter()
                .rposition(|b| *b == b'\n')
                .map_or(0, |i| i + 1)
        };
        if cut == 0 {
            return Vec::new();
        }
        let done: Vec<u8> = self.pending.drain(..cut).collect();
        redact(&done).into_bytes()
    }

    /// The scrubbed unfinished tail, at end of stream.
    pub fn finish(&mut self) -> Vec<u8> {
        let rest = std::mem::take(&mut self.pending);
        redact(&rest).into_bytes()
    }
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
        assert_eq!(generation(&path), 2);
    }

    #[test]
    fn a_follower_reads_every_byte_across_a_rotation() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("log");
        let mut log = CappedLog::open(&path).unwrap();
        let mut cursor = Cursor::default();
        let mut seen: Vec<u8> = Vec::new();
        let mut sent: Vec<u8> = Vec::new();
        for i in 0..40u8 {
            let line = vec![b'a' + (i % 26); (LOG_CAP / 32) as usize];
            log.write(&line).unwrap();
            sent.extend(&line);
            if i % 3 == 0 {
                seen.extend(read_new(&path, &mut cursor));
            }
        }
        seen.extend(read_new(&path, &mut cursor));
        assert_eq!(seen, sent);
    }

    #[test]
    fn two_rotations_between_reads_say_output_was_skipped() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("log");
        let mut log = CappedLog::open(&path).unwrap();
        let mut cursor = Cursor::default();
        let chunk = vec![b'x'; (LOG_CAP / 4) as usize];
        for _ in 0..6 {
            log.write(&chunk).unwrap();
        }
        assert!(read_new(&path, &mut cursor).starts_with(SKIPPED));
    }

    #[test]
    fn lines_are_scrubbed_whole_and_a_long_partial_is_flushed() {
        let mut lines = Lines::default();
        assert!(lines.push(b"mail ada@exa").is_empty());
        let out = String::from_utf8(lines.push(b"mple.com done\nnext")).unwrap();
        assert!(!out.contains("ada@example.com"), "{out}");
        assert!(out.ends_with('\n'));
        assert!(!lines.push(&vec![b'z'; MAX_PARTIAL + 1]).is_empty());
        assert_eq!(lines.finish(), Vec::<u8>::new());
    }
}
