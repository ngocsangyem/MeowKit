//! `skill fork <name> <new-name>`: copy a skill under a name the user owns.
//!
//! The copy sits beside the original in each skills directory the original is
//! installed in, with its SKILL.md `name` set to the new name. No ledger owns
//! it, so no kit change reaches it; the store records it as forked, so
//! install, upgrade and uninstall keep it even if the kit later ships a skill
//! of the same name.
use mewkit_core::fsx::{RelPath, sha256_hex};
use mewkit_core::skill_env::is_skill_dir_name;
use mewkit_core::skill_store::{
    SkillRecord, State, TreeFile, Write, apply, no_rows_hash, read_tree, tree_digest,
};

use super::{matching, open};
use crate::failure::{Failure, OK};
use crate::place::Place;

pub fn run(place: &Place, name: Option<&str>, new_name: Option<&str>) -> Result<u8, Failure> {
    let (Some(name), Some(new_name)) = (name, new_name) else {
        return Err(Failure::usage(
            "`mewkit skill fork` needs a skill and a new name: mewkit skill fork <name> <new-name>",
        ));
    };
    if !is_skill_dir_name(new_name) || new_name.starts_with("mk-") {
        return Err(Failure::usage(format!(
            "{new_name} is not a name a fork can take: lower-case letters, digits and `-`, \
             not starting with `mk-` (the kit's own prefix)"
        )));
    }
    let store = open(place)?;
    let (mut next, _) = store.index(&store.checked())?;
    let keys = matching(&next, name)?;
    let mut writes = Vec::new();
    let mut made = Vec::new();
    for key in &keys {
        let root = key.rsplit_once('/').map_or("", |(root, _)| root);
        let dest = RelPath::new(&format!("{root}/{new_name}"))?;
        if store.layout.resolve(&dest).exists() || next.records.contains_key(dest.as_str()) {
            return Err(Failure::failed(format!("{dest} already exists")));
        }
        let source = store.layout.resolve(&RelPath::new(key)?);
        let mut files = Vec::new();
        for file in read_tree(&source)? {
            let mut bytes = std::fs::read(source.join(&file.path))?;
            if file.path == "SKILL.md" {
                bytes = renamed(&bytes, new_name);
            }
            files.push(TreeFile {
                sha256: sha256_hex(&bytes),
                ..file.clone()
            });
            writes.push(Write {
                path: RelPath::new(&format!("{dest}/{}", file.path))?,
                bytes,
                mode: file.exec.then_some(0o755),
            });
        }
        next.records.insert(
            dest.to_string(),
            SkillRecord {
                name: new_name.to_owned(),
                state: State::Forked,
                digest: tree_digest(&files),
                owners: vec!["user".to_owned()],
                base: Some(next.records[key].digest.clone()),
                history: Vec::new(),
                ledger_hash: no_rows_hash(),
                unverified: false,
                user_created: true,
                fork_of: Some(key.clone()),
                overlay: Default::default(),
            },
        );
        made.push((key.clone(), dest));
    }
    apply(&store.layout, &store.paths, &writes, &[], &[])?;
    let store = open(place)?;
    let (indexed, survey) = store.index(&next)?;
    store.save(&indexed, &survey)?;
    for (from, to) in &made {
        println!("forked {from} to {to}");
    }
    Ok(OK)
}

/// SKILL.md with the frontmatter `name:` set to `new_name`; unchanged when it
/// has no frontmatter or no name line.
fn renamed(bytes: &[u8], new_name: &str) -> Vec<u8> {
    let Ok(text) = std::str::from_utf8(bytes) else {
        return bytes.to_vec();
    };
    let Some(rest) = text.strip_prefix("---\n") else {
        return bytes.to_vec();
    };
    let Some(end) = rest.find("\n---") else {
        return bytes.to_vec();
    };
    let mut out = String::from("---\n");
    let mut done = false;
    for line in rest[..end].split_inclusive('\n') {
        if !done && line.starts_with("name:") {
            let newline = if line.ends_with('\n') { "\n" } else { "" };
            out.push_str(&format!("name: {new_name}{newline}"));
            done = true;
        } else {
            out.push_str(line);
        }
    }
    out.push_str(&rest[end..]);
    out.into_bytes()
}

#[cfg(test)]
mod tests {
    use super::renamed;

    #[test]
    fn the_frontmatter_name_takes_the_new_name() {
        let out = renamed(b"---\nname: mk:fix\ndescription: x\n---\nbody\n", "my-fix");
        assert_eq!(out, b"---\nname: my-fix\ndescription: x\n---\nbody\n");
    }
}
