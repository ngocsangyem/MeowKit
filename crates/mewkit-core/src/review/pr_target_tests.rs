use super::{match_remote, parse_git_remotes, parse_pr_target};

const FORK_AND_UPSTREAM: &str = "origin\tgit@github.com:me/fork.git (fetch)\n\
     upstream\thttps://github.com/acme/widget.git (fetch)\n";

fn target(owner: Option<&str>, repo: Option<&str>, pr: f64) -> super::PrTarget {
    super::PrTarget {
        owner: owner.map(str::to_string),
        repo: repo.map(str::to_string),
        pr,
    }
}

#[test]
fn a_pr_url_an_owner_repo_hash_and_a_bare_number_all_parse() {
    let url = parse_pr_target("https://github.com/acme/widget/pull/9").expect("a URL parses");
    assert_eq!(
        (url.owner.as_deref(), url.repo.as_deref(), url.pr),
        (Some("acme"), Some("widget"), 9.0)
    );
    let dotted = parse_pr_target("https://github.com/acme/widget.git/pull/9/").expect("a .git URL");
    assert_eq!(dotted.repo.as_deref(), Some("widget"));
    let hash = parse_pr_target("acme/widget#12").expect("owner/repo#n");
    assert_eq!(hash.pr, 12.0);
    let bare = parse_pr_target(" #7 ").expect("a bare number");
    assert_eq!((bare.owner.clone(), bare.pr), (None, 7.0));
}

#[test]
fn ambiguous_or_invalid_input_is_refused_rather_than_guessed() {
    assert_eq!(parse_pr_target("").unwrap_err(), "empty PR target");
    assert_eq!(
        parse_pr_target("0").unwrap_err(),
        "invalid PR number: \"0\""
    );
    assert_eq!(
        parse_pr_target("not a pr").unwrap_err(),
        "unrecognized PR target: \"not a pr\" (use a PR URL, owner/repo#123, or a bare number)"
    );
    // A bare number cannot name a repository, so two remotes make it ambiguous.
    let remotes = parse_git_remotes(FORK_AND_UPSTREAM);
    assert_eq!(
        match_remote(&remotes, &target(None, None, 9.0), None).unwrap_err(),
        "bare PR number is ambiguous across 2 remotes; use owner/repo#<n> or --remote <name>"
    );
}

#[test]
fn only_fetch_lines_of_github_remotes_are_candidates() {
    let remotes = parse_git_remotes(
        "origin\tgit@github.com:me/fork.git (fetch)\n\
         origin\tgit@github.com:me/fork.git (push)\n\
         gl\tgit@gitlab.com:me/other.git (fetch)\n",
    );
    assert_eq!(remotes.len(), 1);
    assert_eq!(
        (remotes[0].name.as_str(), remotes[0].owner.as_str()),
        ("origin", "me")
    );
}

#[test]
fn a_wrong_or_overridden_remote_is_refused() {
    let remotes = parse_git_remotes(FORK_AND_UPSTREAM);
    assert_eq!(
        match_remote(&remotes, &target(Some("ghost"), Some("nope"), 1.0), None).unwrap_err(),
        "no remote points at the PR base ghost/nope; pass --remote <name>"
    );
    // The override names the FORK while the PR's base is upstream: trusting it
    // would fetch a diff from the wrong repository.
    assert_eq!(
        match_remote(
            &remotes,
            &target(Some("acme"), Some("widget"), 1.0),
            Some("origin")
        )
        .unwrap_err(),
        "remote \"origin\" points at me/fork, not the PR base acme/widget"
    );
    assert_eq!(
        match_remote(&remotes, &target(None, None, 1.0), Some("nope")).unwrap_err(),
        "remote \"nope\" not found"
    );
}

#[test]
fn a_fork_layout_resolves_to_the_base_remote() {
    let remotes = parse_git_remotes(FORK_AND_UPSTREAM);
    let chosen = match_remote(&remotes, &target(Some("acme"), Some("widget"), 9.0), None)
        .expect("the base remote matches");
    assert_eq!(chosen.remote, "upstream");
}

#[test]
fn a_repeated_remote_name_is_not_a_second_candidate() {
    let remotes = parse_git_remotes(
        "origin\thttps://github.com/acme/widget.git (fetch)\n\
         other\thttps://github.com/ACME/Widget (fetch)\n",
    );
    // Two DISTINCT names for the same repository: the caller has to choose.
    assert_eq!(
        match_remote(&remotes, &target(Some("acme"), Some("widget"), 1.0), None).unwrap_err(),
        "multiple remotes point at acme/widget (origin, other); pass --remote <name>"
    );
}

#[test]
fn a_lone_remote_resolves_a_bare_number() {
    let remotes = parse_git_remotes("origin\thttps://github.com/acme/widget.git (fetch)\n");
    assert_eq!(
        match_remote(&remotes, &target(None, None, 4.0), None)
            .expect("a lone remote")
            .remote,
        "origin"
    );
    assert_eq!(
        match_remote(&[], &target(None, None, 4.0), None).unwrap_err(),
        "no github remote found; pass owner/repo#<n> and --remote <name>"
    );
}
