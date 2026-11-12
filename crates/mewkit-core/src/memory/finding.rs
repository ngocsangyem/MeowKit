//! What the memory scan reports: the finding kinds and one finding.
//!
//! Split out from the scan itself because the walk, the lint and the scan all
//! produce these, and the kind strings are a printed contract — `validate --memory`
//! and CI show them, so they are not debug labels.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MemoryFindingKind {
    Size,
    ByteCap,
    LongLine,
    Flood,
    Injection,
    Secret,
    Unreadable,
}

impl MemoryFindingKind {
    /// The wire name, identical to the TS `MemoryFindingKind` union member.
    pub fn as_str(self) -> &'static str {
        match self {
            MemoryFindingKind::Size => "size",
            MemoryFindingKind::ByteCap => "byte-cap",
            MemoryFindingKind::LongLine => "long-line",
            MemoryFindingKind::Flood => "flood",
            MemoryFindingKind::Injection => "injection",
            MemoryFindingKind::Secret => "secret",
            MemoryFindingKind::Unreadable => "unreadable",
        }
    }
}

impl std::fmt::Display for MemoryFindingKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

/// One problem found in one body of content.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ContentFinding {
    /// 1-based line number; 0 when the finding is about the content as a whole.
    pub line: usize,
    pub kind: MemoryFindingKind,
    pub detail: String,
}
