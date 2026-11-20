"""Project `.claude/skills` Markdown bodies to the Codex form with mechanical
rules and compare the result with the hand-ported bundle, line by line.

Run from anywhere: python3 measure-source-vs-codex-bundle.py [--examples out.json]
Frontmatter is excluded and blank lines are ignored.
"""
import collections, difflib, json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..'))
SRC = f'{ROOT}/.claude/skills'
BUNDLE = f'{ROOT}/kit/bundles/codex/root/.agents/skills'
SKILLS = sorted(d for d in os.listdir(SRC) if os.path.isdir(f'{SRC}/{d}') and not d.startswith('.'))
SKILL_ALT = '|'.join(sorted(map(re.escape, SKILLS), key=len, reverse=True))

# Always-on rule file -> AGENTS.md section heading in the Codex bundle.
RULE_SECTION = {
    'injection-rules.md': 'Data & injection boundary',
    'security-rules.md': 'Security',
    'core-behaviors.md': 'Core behaviors',
    'development-rules.md': 'Development',
    'meowkit-core.md': 'Planning, review and the ship check',
    'agent-conduct.md': 'Subagent status protocol',
}


# Names that hold the host's name without meaning the runtime the text runs on.
PROPER_NAMES = [
    '[Claude Code](https://claude.com/claude-code)', 'claude.com', 'claude.ai', 'Claude Desktop',
    'Support/Claude', 'Claude/GPT', 'non-Claude', 'Claude-XML', 'Claude-specific',
    'claude-prompting-best-practices', 'everything-claude-code', 'claude-cowork', 'claude-md',
    'Claude Official', 'claude-official', 'arrow-claude',
]


def host_words(body):
    """Host name -> Codex, except inside a proper name."""
    kept = []
    def shield(m):
        kept.append(m.group(0)); return f'\x00{len(kept) - 1}\x00'
    body = re.sub('|'.join(map(re.escape, PROPER_NAMES)), shield, body)
    body = body.replace('Claude Code', 'Codex')
    body = re.sub(r'claude-(?:opus|sonnet|haiku|fable)-[0-9][0-9-]*', '<model-id>', body)
    body = re.sub(r'\bClaude\b', 'Codex', body)
    body = re.sub(r'(?<![A-Za-z_])claude(?![A-Za-z_])', 'codex', body)
    return re.sub(r'\x00(\d+)\x00', lambda m: kept[int(m.group(1))], body)


def anchor(heading):
    text = heading.lstrip('#').strip()
    return ''.join('-' if c == ' ' else c.lower() for c in text if c.isalnum() or c in ' -_')


def headings(text):
    out, fenced = [], False
    for line in text.split('\n'):
        if line.lstrip().startswith('```'):
            fenced = not fenced
        if not fenced and re.match(r'#+ ', line):
            out.append(line)
    return out


def follow_headings(source, projected):
    """An in-file link to a reworded heading takes the heading's new anchor."""
    before, after = headings(source), headings(projected)
    if len(before) != len(after):
        return projected
    for old, new in zip(map(anchor, before), map(anchor, after)):
        if old != new:
            for stale in (host_words(old), old):
                if stale != new:
                    projected = projected.replace(f'(#{stale})', f'(#{new})')
    return projected


def split_frontmatter(text):
    if text.startswith('---\n'):
        end = text.find('\n---', 4)
        if end > 0:
            return text[:end + 4], text[end + 4:]
    return '', text


def anchor_scripts(body, skill, has):
    """A skill-relative `scripts/…` or `bin/…` path the skill has -> root-anchored.
    Codex runs a skill's commands from the project root; `codex/rewrite.rs::root_anchor`
    does this at install time for `<interpreter> <path>`, the bundle by hand elsewhere."""
    def sub(m):
        path = m.group(2)
        if path.rstrip('.,;:') not in has:
            return m.group(0)
        return f'.agents/skills/mk-{skill}/{path}'
    return re.sub(r'(?<![\w/.{}-])(\./)?((?:scripts|bin)/[^\s`\'")]+)', sub, body)


def project(source, skill, has):
    body = source
    # The note telling the reader to prefix script paths by hand; anchoring does it.
    body = '\n'.join(l for l in body.split('\n') if not l.startswith("> Script paths in this skill's other files"))
    # Skill names and invocations.
    name = r'([a-z][a-z0-9-]*|\[[a-z]{2,}\]|<[a-z]{2,}>|\{[a-z]{2,}\})'   # a slug or a placeholder for one
    body = re.sub(rf'(?<![\w/.-])/mk:{name}', r'$mk-\1', body)
    body = re.sub(rf'(?<!\w)mk:{name}', r'mk-\1', body)
    # Paths.
    body = re.sub(rf'\.claude/skills/({SKILL_ALT})(?![\w-])', r'.agents/skills/mk-\1', body)
    body = body.replace('.claude/skills', '.agents/skills')
    body = re.sub(r'\.claude/agents/([a-z0-9-]+)\.md', r'.codex/agents/\1.toml', body)
    body = re.sub(rf'\.\./({SKILL_ALT})/', r'../mk-\1/', body)
    body = body.replace('${CLAUDE_SKILL_DIR}', f'.agents/skills/mk-{skill}')
    body = re.sub(r'(`?)\.claude/rules/([a-z-]+\.md)\1',   # code quotes dropped only as a pair
                  lambda m: f'AGENTS.md ({RULE_SECTION[m.group(2)]})' if m.group(2) in RULE_SECTION else m.group(0), body)
    body = body.replace('.claude/hooks/lib/skill-python.cjs', '.codex/scripts/skill-python.cjs')
    body = body.replace('.claude/hooks/lib/setup-workflow', 'mewkit setup')
    for lib in ('project-root.cjs', 'validate-content.cjs'):   # loaded by the hooks too; they stay beside them
        body = body.replace(f'.claude/hooks/lib/{lib}', f'.codex/hooks/lib/{lib}')
    body = body.replace('.claude/hooks/lib/', '.codex/scripts/bin/')
    # Environment.
    body = body.replace('CLAUDE_PLUGIN_DATA', 'PLUGIN_DATA')
    body = re.sub(r'\$\{CLAUDE_PROJECT_DIR\}|\$CLAUDE_PROJECT_DIR', '$(git rev-parse --show-toplevel)', body)
    # Host name.
    body = body.replace('.claude/', '.codex/').replace('CLAUDE.md', 'AGENTS.md')
    body = host_words(body)
    return follow_headings(source, anchor_scripts(body, skill, has))


def equivalent(line):
    """Fold forms the bundle uses interchangeably, so they do not count as a difference."""
    line = re.sub(r'`?\$mk-([a-z0-9-]+)`?', r'the \1 skill', line)          # invocation vs "the x skill"
    line = re.sub(r'(?i)\*{0,2}\b(?:sub-tasks?|subagents?)\b\*{0,2}', 'SUBAGENT', line)  # delegation noun, number, case
    line = re.sub(r'`AGENTS\.md`', 'AGENTS.md', line)
    return line


def classify(src_line, bundle_line, missing_refs):
    if any(ref in src_line for ref in missing_refs):
        return 'reference to a file the bundle did not port'
    if re.search(r'AGENTS\.md|\.codex/rules', src_line + bundle_line) and 'AGENTS.md' in bundle_line:
        return 'rule-file reference reworded by hand'
    if re.search(r'\.env\b|env file', src_line + bundle_line):
        return 'env file location'
    if re.search(r'\b(?:sonnet|opus|haiku|STANDARD|COMPLEX|TRIVIAL)\b', src_line + bundle_line) and \
            re.search(r'\b(?:STANDARD|COMPLEX|TRIVIAL|[Tt]ier)\b', bundle_line):
        return 'model name vs tier word'
    if '.agents/skills/mk-' in bundle_line and '.agents/skills/mk-' not in src_line:
        return 'path anchored by hand in the bundle'
    if re.search(r'CLAUDE_|project environment', src_line + bundle_line):
        return 'environment variable'
    if re.search(r'AskUserQuestion|subagent_type|Agent\(|Task\(|ExitPlanMode|TodoWrite', src_line):
        return 'tool name left in the source'
    if difflib.SequenceMatcher(None, src_line, bundle_line).ratio() >= 0.85:
        return 'small wording change'
    return 'rewritten line'


def main():
    files = collections.Counter(); classes = collections.Counter(); examples = collections.defaultdict(list)
    per_file = collections.Counter(); dropped = added = 0; unported = []
    for skill in SKILLS:
        src_dir, bundle_dir = f'{SRC}/{skill}', f'{BUNDLE}/mk-{skill}'
        if not os.path.isdir(bundle_dir):
            files['skill not in bundle'] += 1
            continue
        has, pairs_todo, missing_refs = set(), [], set()
        for dp, _, fn in os.walk(src_dir):
            for f in fn:
                rel = os.path.relpath(os.path.join(dp, f), src_dir)
                has.add(rel)
                if f.endswith('.md'):
                    if os.path.exists(f'{bundle_dir}/{rel}'):
                        pairs_todo.append(rel)
                    else:
                        files['file not in bundle'] += 1; unported.append(f'{skill}/{rel}')
        for rel in pairs_todo:
            _, src_body = split_frontmatter(open(f'{src_dir}/{rel}', encoding='utf8').read())
            _, bun_body = split_frontmatter(open(f'{bundle_dir}/{rel}', encoding='utf8').read())
            a = [equivalent(l.rstrip()) for l in project(src_body, skill, has).split('\n') if l.strip()]
            b = [equivalent(l.rstrip()) for l in anchor_scripts(bun_body, skill, has).split('\n') if l.strip()]
            if a == b:
                files['identical'] += 1; continue
            files['differ'] += 1
            for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
                if tag == 'equal': continue
                n = min(i2 - i1, j2 - j1)
                for k in range(n):
                    c = classify(a[i1 + k], b[j1 + k], UNPORTED_NAMES)
                    classes[c] += 1; examples[c].append((f'{skill}/{rel}', a[i1 + k], b[j1 + k]))
                dropped += i2 - i1 - n; added += j2 - j1 - n
                per_file[f'{skill}/{rel}'] += max(i2 - i1, j2 - j1)
    print('FILES', dict(files))
    print('LINE PAIRS THAT DIFFER', sum(classes.values()))
    for c, n in classes.most_common(): print(f'  {n:5d}  {c}')
    print('SOURCE LINES WITH NO BUNDLE LINE', dropped, '| BUNDLE LINES WITH NO SOURCE LINE', added)
    print('MOST AFFECTED FILES'); [print(f'  {n:5d}  {f}') for f, n in per_file.most_common(15)]
    if '--examples' in sys.argv:
        json.dump({'examples': examples, 'unported': unported}, open(sys.argv[sys.argv.index('--examples') + 1], 'w'))


def unported_names():
    names = set()
    for skill in SKILLS:
        if not os.path.isdir(f'{BUNDLE}/mk-{skill}'): continue
        for dp, _, fn in os.walk(f'{SRC}/{skill}'):
            for f in fn:
                rel = os.path.relpath(os.path.join(dp, f), f'{SRC}/{skill}')
                if f.endswith('.md') and not os.path.exists(f'{BUNDLE}/mk-{skill}/{rel}'):
                    names.add(f'mk-{skill}/{rel}'); names.add(rel) if '/' in rel else None
    return names


UNPORTED_NAMES = unported_names()
if __name__ == '__main__':
    main()
