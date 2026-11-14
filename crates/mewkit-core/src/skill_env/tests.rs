use std::fs;

use super::*;

fn skill(root: &Path, name: &str, files: &[(&str, &str)]) {
    let dir = root.join(".claude").join("skills").join(name);
    for (rel, body) in files {
        let path = dir.join(rel);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, body).unwrap();
    }
}

#[test]
fn skill_names_are_lowercase_alphanumeric_with_dashes() {
    assert!(is_skill_dir_name("web-to-markdown"));
    assert!(is_skill_dir_name("0day"));
    for bad in ["", "-x", "X", "a_b", "../x", "a b"] {
        assert!(!is_skill_dir_name(bad), "{bad}");
    }
    assert!(skill_env_dir(Path::new("/p"), "../etc").is_err());
}

#[test]
fn runtime_reads_inline_and_block_forms() {
    let tmp = tempfile::tempdir().unwrap();
    skill(
        tmp.path(),
        "a",
        &[(
            "SKILL.md",
            "---\nname: a\nrequires_runtime: [\"python>=3.9\", node]\n---\nbody",
        )],
    );
    skill(
        tmp.path(),
        "b",
        &[(
            "SKILL.md",
            "---\nrequires_runtime:\n  - Python>=3\n  - 'x'\n---\n",
        )],
    );
    skill(tmp.path(), "c", &[("SKILL.md", "---\nname: c\n---\n")]);
    let a = read_skill_runtime(tmp.path(), "a").unwrap();
    assert_eq!(a.entries, ["python>=3.9", "node"]);
    assert_eq!(a.interpreter, "python");
    let b = read_skill_runtime(tmp.path(), "b").unwrap();
    assert_eq!(b.entries, ["Python>=3", "x"]);
    assert_eq!(b.interpreter, "python");
    assert!(read_skill_runtime(tmp.path(), "c").is_none());
}

#[test]
fn a_crlf_frontmatter_declares_nothing_as_in_the_npm_cli() {
    let tmp = tempfile::tempdir().unwrap();
    skill(
        tmp.path(),
        "a",
        &[("SKILL.md", "---\r\nrequires_runtime: [python]\r\n---\r\n")],
    );
    assert!(read_skill_runtime(tmp.path(), "a").is_none());
}

#[test]
fn eligible_skills_declare_a_runtime_or_pin_packages() {
    let tmp = tempfile::tempdir().unwrap();
    skill(
        tmp.path(),
        "py",
        &[("SKILL.md", "---\nrequires_runtime: [python]\n---\n")],
    );
    skill(
        tmp.path(),
        "bin",
        &[
            ("SKILL.md", "---\n---\n"),
            ("scripts/requirements.txt", "x==1\n"),
        ],
    );
    skill(tmp.path(), "none", &[("SKILL.md", "---\n---\n")]);
    skill(tmp.path(), ".hidden", &[("requirements.txt", "x\n")]);
    assert_eq!(env_skills(tmp.path()), ["bin", "py"]);
}

#[test]
fn requirement_lines_are_validated_by_base_name_only() {
    for ok in ["pillow>=10.0", "requests[socks]==2.0", "a.b-c_d", "x~=1.0"] {
        assert!(validate_package_name(ok), "{ok}");
    }
    for bad in ["", "-r other.txt", "git+https://x/y", "bad name", "$(x)"] {
        assert!(!validate_package_name(bad), "{bad}");
    }
    // What follows the specifier is not looked at: shared with the npm CLI.
    assert!(validate_package_name("pillow>=10.0 --extra-index-url"));
    assert_eq!(base_package_name("Pillow>=10"), "pillow");
}

#[test]
fn requirements_split_into_pins_and_rejects() {
    let tmp = tempfile::tempdir().unwrap();
    skill(
        tmp.path(),
        "a",
        &[("requirements.txt", "# c\n\nfoo==1\n  -e .\n")],
    );
    let req = read_skill_requirements(tmp.path(), "a").unwrap();
    assert_eq!(req.packages.len(), 1);
    assert_eq!(req.rejected, ["-e ."]);
    skill(tmp.path(), "b", &[("SKILL.md", "")]);
    assert!(
        read_skill_requirements(tmp.path(), "b")
            .unwrap()
            .source
            .is_none()
    );
}

#[test]
fn package_lists_pad_to_eighteen_columns() {
    let pkgs = [SkillsDependency {
        name: "ab".into(),
        description: String::new(),
    }];
    assert_eq!(
        format_package_list(&pkgs),
        format!("  ab{}", " ".repeat(16))
    );
}

#[test]
fn environment_paths_follow_the_platform() {
    let env = Path::new("/p/.meowkit/envs/x");
    if cfg!(windows) {
        assert!(env_python_path(env).ends_with("Scripts/python.exe"));
        assert!(env_pip_path(env).ends_with("Scripts/pip.exe"));
    } else {
        assert!(env_python_path(env).ends_with("bin/python3"));
        assert!(env_pip_path(env).ends_with("bin/pip"));
    }
}
