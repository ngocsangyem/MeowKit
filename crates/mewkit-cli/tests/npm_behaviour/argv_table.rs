//! The minimist flag table the Rust CLI carries must be the npm CLI's.
//!
//! `src/minimist_flags.rs` decides which unknown tokens swallow a value, so a
//! flag added to the command catalogue and not to that file would make the
//! two CLIs read the same argv differently. The npm CLI's flag names, as its
//! catalogue declared them when it was retired, are frozen below; this compares
//! them with the table.
use std::collections::BTreeSet;

use crate::npm;

/// Every boolean flag the npm CLI's catalogue declared.
const NPM_BOOLEANS: &str = "activate,adopt,agents,all,allow-cloud-mcp,allow-kit-source,beta,\
capabilities,check,commit,docs-refs,dry-run,explain,force,frontmatter,gates,hard-gates,help,json,\
lifecycle,list,memory,monthly,no-cleanup,ownership,packs,portable,providers,record,reply,report,\
rules,state,strict,structural,substrate,system-deps,version,workflow,write,yes";

/// Every value-taking flag the npm CLI's catalogue declared.
const NPM_STRINGS: &str = "as,blocker,by,capability-decision,checkpoint,confirm,correction,\
correction-kind,day,delivery,directive,disposition,evidence,evidence-pointer,evidence-ref,\
fail-over,friction,id,intent,mcp-profiles,mode,next,only,outcome,packet-kind,plan,priority,\
profile,provider,question,reason,release-stage,remote,responsibility,run,session,skill,\
skill-packs,skills,slug,stage,status,step,target,task-id,type,verification";

/// The quoted names inside `pub const <name>: &[&str] = &[ ... ];`.
fn rust_list(source: &str, name: &str) -> BTreeSet<String> {
    let start = source
        .find(&format!("pub const {name}"))
        .unwrap_or_else(|| panic!("{name} not found in minimist_flags.rs"));
    let body = &source[start..];
    let body = &body[body.find("&[").expect("list start") + 2..body.find("];").expect("list end")];
    body.split('"')
        .skip(1)
        .step_by(2)
        .map(str::to_string)
        .collect()
}

fn frozen(list: &str) -> BTreeSet<String> {
    list.split(',').map(str::to_string).collect()
}

#[test]
fn the_flag_table_matches_the_npm_catalogue() {
    let source =
        std::fs::read_to_string(npm::repo_root().join("crates/mewkit-cli/src/minimist_flags.rs"))
            .expect("read minimist_flags.rs");

    assert_eq!(rust_list(&source, "GLOBAL_BOOLEANS"), frozen(NPM_BOOLEANS));
    assert_eq!(rust_list(&source, "GLOBAL_STRINGS"), frozen(NPM_STRINGS));
    // The npm catalogue's aliases were `h=help`, `v=version` and `y=yes`.
    assert!(source.contains("('h', \"help\"), ('v', \"version\"), ('y', \"yes\")"));
}
