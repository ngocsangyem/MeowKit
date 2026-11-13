//! Which pull request, on which remote — decided without touching git or the
//! network.
//!
//! Nothing here GUESSES. A bare number across two remotes, a `--remote` that
//! points at a fork rather than the PR's base repository, an owner/repo no
//! remote serves: each is a typed refusal naming what to pass instead. A
//! wrongly chosen base repository produces a review of the wrong diff, which
//! reads as a real review and is not one.
use std::sync::LazyLock;

use regex::Regex;

/// The PR a target names. `owner`/`repo` are absent for a bare number, which
/// is resolvable only against a lone remote.
#[derive(Debug, Clone, PartialEq)]
pub struct PrTarget {
    pub owner: Option<String>,
    pub repo: Option<String>,
    /// Held as a double because the npm CLI holds a JavaScript `Number`, and
    /// the value is stringified into an argv.
    pub pr: f64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Remote {
    pub name: String,
    pub url: String,
    pub owner: String,
    pub repo: String,
}

/// The remote to FETCH from: the PR's base repository.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RemoteMatch {
    pub remote: String,
    pub owner: String,
    pub repo: String,
}

static PR_URL_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)^https?://github\.com/([^/]+)/([^/]+?)(?:\.git)?/pull/([0-9]+)/?$")
        .expect("static PR url pattern")
});
static OWNER_REPO_HASH_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^([A-Za-z0-9._-]+)/([A-Za-z0-9._-]+)#([0-9]+)$")
        .expect("static owner/repo pattern")
});
static BARE_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^#?([0-9]+)$").expect("static bare number pattern"));
static FETCH_LINE_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^(\S+)\s+(\S+)\s+\(fetch\)").expect("static remote line pattern")
});
static GITHUB_URL_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)github\.com[/:]([^/]+)/(.+?)(?:\.git)?/?$").expect("static github url pattern")
});

/// `Number(digits)` for a digit string: exact below 2^53, and the same
/// rounded double above it, so a stringified PR number matches.
fn js_number(digits: &str) -> f64 {
    digits.parse::<f64>().unwrap_or(f64::NAN)
}

/// A full PR URL, `owner/repo#123`, or a bare `123` / `#123`.
pub fn parse_pr_target(input: &str) -> Result<PrTarget, String> {
    let s = input.trim();
    if s.is_empty() {
        return Err("empty PR target".to_string());
    }
    if let Some(url) = PR_URL_RE.captures(s) {
        return Ok(PrTarget {
            owner: Some(url[1].to_string()),
            repo: Some(url[2].to_string()),
            pr: js_number(&url[3]),
        });
    }
    if let Some(oh) = OWNER_REPO_HASH_RE.captures(s) {
        return Ok(PrTarget {
            owner: Some(oh[1].to_string()),
            repo: Some(oh[2].to_string()),
            pr: js_number(&oh[3]),
        });
    }
    if let Some(bare) = BARE_RE.captures(s) {
        let pr = js_number(&bare[1]);
        if !pr.is_finite() || pr.fract() != 0.0 || pr <= 0.0 {
            return Err(format!("invalid PR number: \"{s}\""));
        }
        return Ok(PrTarget {
            owner: None,
            repo: None,
            pr,
        });
    }
    Err(format!(
        "unrecognized PR target: \"{s}\" (use a PR URL, owner/repo#123, or a bare number)"
    ))
}

/// `git remote -v` into GitHub remotes. Fetch lines only, first spelling of
/// each name wins, and a non-GitHub remote is simply not a candidate.
pub fn parse_git_remotes(remote_v: &str) -> Vec<Remote> {
    let mut seen: Vec<String> = Vec::new();
    let mut out = Vec::new();
    for line in remote_v.split('\n') {
        let Some(m) = FETCH_LINE_RE.captures(line) else {
            continue;
        };
        let (name, url) = (m[1].to_string(), m[2].to_string());
        if seen.contains(&name) {
            continue;
        }
        let Some(gh) = GITHUB_URL_RE.captures(&url) else {
            continue;
        };
        seen.push(name.clone());
        out.push(Remote {
            name,
            owner: gh[1].to_string(),
            repo: gh[2].to_string(),
            url,
        });
    }
    out
}

fn same_repo(remote: &Remote, target: &PrTarget) -> bool {
    let (Some(owner), Some(repo)) = (&target.owner, &target.repo) else {
        return false;
    };
    remote.owner.eq_ignore_ascii_case(owner) && remote.repo.eq_ignore_ascii_case(repo)
}

fn as_match(remote: &Remote) -> RemoteMatch {
    RemoteMatch {
        remote: remote.name.clone(),
        owner: remote.owner.clone(),
        repo: remote.repo.clone(),
    }
}

/// Choose the remote hosting the PR's BASE repository. An explicit override
/// still has to agree with a known owner/repo — trusting it blindly is how a
/// fork gets reviewed as if it were upstream.
pub fn match_remote(
    remotes: &[Remote],
    target: &PrTarget,
    explicit_override: Option<&str>,
) -> Result<RemoteMatch, String> {
    if let Some(name) = explicit_override.filter(|n| !n.is_empty()) {
        let Some(remote) = remotes.iter().find(|r| r.name == name) else {
            return Err(format!("remote \"{name}\" not found"));
        };
        if target.owner.is_some() && !same_repo(remote, target) {
            return Err(format!(
                "remote \"{name}\" points at {}/{}, not the PR base {}/{}",
                remote.owner,
                remote.repo,
                target.owner.as_deref().unwrap_or_default(),
                target.repo.as_deref().unwrap_or_default()
            ));
        }
        return Ok(as_match(remote));
    }

    if let (Some(owner), Some(repo)) = (&target.owner, &target.repo) {
        let matches: Vec<&Remote> = remotes.iter().filter(|r| same_repo(r, target)).collect();
        let mut names: Vec<&str> = Vec::new();
        for m in &matches {
            if !names.contains(&m.name.as_str()) {
                names.push(&m.name);
            }
        }
        return match names.len() {
            0 => Err(format!(
                "no remote points at the PR base {owner}/{repo}; pass --remote <name>"
            )),
            1 => Ok(as_match(matches[0])),
            _ => Err(format!(
                "multiple remotes point at {owner}/{repo} ({}); pass --remote <name>",
                names.join(", ")
            )),
        };
    }

    match remotes.len() {
        0 => Err("no github remote found; pass owner/repo#<n> and --remote <name>".to_string()),
        1 => Ok(as_match(&remotes[0])),
        n => Err(format!(
            "bare PR number is ambiguous across {n} remotes; use owner/repo#<n> or --remote <name>"
        )),
    }
}

#[cfg(test)]
#[path = "pr_target_tests.rs"]
mod tests;
