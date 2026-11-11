//! Helpers for the binary release tests: the release scripts (run with
//! `node`), fake archives and a local HTTP server standing in for GitHub.
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

pub const TARGETS: [&str; 6] = [
    "x86_64-unknown-linux-musl",
    "aarch64-unknown-linux-musl",
    "x86_64-apple-darwin",
    "aarch64-apple-darwin",
    "x86_64-pc-windows-msvc",
    "aarch64-pc-windows-msvc",
];

pub fn repo() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

/// `node scripts/release/<script> args…` from the repository root.
pub fn node(script: &str, args: &[&str]) -> Output {
    Command::new("node")
        .current_dir(repo())
        .arg(format!("scripts/release/{script}"))
        .args(args)
        .output()
        .expect("node must be on PATH to test the release scripts")
}

pub fn asset_name(version: &str, target: &str) -> String {
    format!("mewkit-next-{version}-{target}.tar.gz")
}

/// A release archive for `target` whose binary holds `body`, laid out as the
/// release job lays it out: one top directory holding the binary.
pub fn archive(version: &str, target: &str, body: &[u8]) -> Vec<u8> {
    let exe = if target.contains("windows") {
        "mewkit-next.exe"
    } else {
        "mewkit-next"
    };
    let mut tar = tar::Builder::new(flate2::write::GzEncoder::new(
        Vec::new(),
        flate2::Compression::default(),
    ));
    let mut header = tar::Header::new_gnu();
    header.set_size(body.len() as u64);
    header.set_mode(0o755);
    header.set_cksum();
    tar.append_data(
        &mut header,
        format!("mewkit-next-{version}-{target}/{exe}"),
        body,
    )
    .unwrap();
    tar.into_inner().unwrap().finish().unwrap()
}

/// A file server on 127.0.0.1 that serves `files` by path and counts requests.
pub struct Server {
    pub base: String,
    hits: Arc<AtomicUsize>,
}

impl Server {
    pub fn start(files: HashMap<String, Vec<u8>>) -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        let hits = Arc::new(AtomicUsize::new(0));
        let counter = hits.clone();
        std::thread::spawn(move || {
            for stream in listener.incoming() {
                let Ok(mut stream) = stream else { continue };
                counter.fetch_add(1, Ordering::SeqCst);
                let mut reader = BufReader::new(stream.try_clone().unwrap());
                let mut line = String::new();
                let _ = reader.read_line(&mut line);
                let path = line.split_whitespace().nth(1).unwrap_or("").to_owned();
                loop {
                    let mut h = String::new();
                    if reader.read_line(&mut h).unwrap_or(0) == 0 || h == "\r\n" {
                        break;
                    }
                }
                let (status, body) = match files.get(&path) {
                    Some(b) => ("200 OK", b.as_slice()),
                    None => ("404 Not Found", &b""[..]),
                };
                let head = format!(
                    "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                    body.len()
                );
                let _ = stream.write_all(head.as_bytes());
                let _ = stream.write_all(body);
            }
        });
        Self { base, hits }
    }

    pub fn hits(&self) -> usize {
        self.hits.load(Ordering::SeqCst)
    }
}
