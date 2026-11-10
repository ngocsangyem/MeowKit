// The ship guard judges the work tree a commit runs in.
//
// In a worktree session the project-dir variable still names the main checkout. The guard used
// to evaluate that checkout, so a commit in the worktree was blocked or cleared by the main
// checkout's branch, HEAD and plan pointer. These tests pin which tree is judged.
//
// Run with: node --test .claude/hooks/__tests__/

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const HOOKS = path.resolve(__dirname, '..');
const { resolveShipRoot } = require('../lib/project-root.cjs');

const tempDir = (prefix) => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
const real = (p) => fs.realpathSync.native(p);

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, stdio: 'pipe' }).toString().trim();
}

function write(dir, rel, body) {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), body);
}

/** A repository with one commit and a linked worktree on its own branch. */
function repoWithWorktree() {
  const main = tempDir('ship-root-main-');
  git(main, 'init', '-q');
  git(main, 'config', 'user.email', 'test@example.com');
  git(main, 'config', 'user.name', 'test');
  write(main, '.gitignore', '.meowkit/\nworktrees/\n');
  write(main, 'README.md', '# base\n');
  git(main, 'add', '-A');
  git(main, 'commit', '-qm', 'base');
  const worktree = path.join(main, 'worktrees', 'side');
  git(main, 'worktree', 'add', '-q', '-b', 'side', worktree);
  return { main, worktree };
}

test('a linked worktree of the guarded repository is the ship root', () => {
  const { main, worktree } = repoWithWorktree();
  fs.mkdirSync(path.join(worktree, 'src'));
  assert.equal(real(resolveShipRoot({ CLAUDE_PROJECT_DIR: main }, path.join(worktree, 'src'))), real(worktree));
  assert.equal(real(resolveShipRoot({ CLAUDE_PROJECT_DIR: main }, main)), real(main));
});

test('the tree the command names wins over the working directory', () => {
  const { main, worktree } = repoWithWorktree();
  const env = { CLAUDE_PROJECT_DIR: main };
  // Standing in a clean worktree must not divert the check from a commit aimed at main.
  assert.equal(resolveShipRoot(env, worktree, `git -C ${main} commit -m x`), main);
  assert.equal(resolveShipRoot(env, worktree, `cd ${main} && git commit -m x`), main);
  assert.equal(resolveShipRoot(env, worktree, `cd "${main}"; git commit -m x`), main);
  // Naming a clean worktree while the commit runs in main changes nothing.
  assert.equal(resolveShipRoot(env, main, `git -C ${worktree} status; git commit -m x`), main);
  assert.equal(resolveShipRoot(env, main, `git commit -m "cd ${worktree}"`), main);
  assert.equal(resolveShipRoot(env, worktree, `git -C${main} commit -m x`), main);
  // A worktree is judged in place only when every tree in play is that worktree.
  assert.equal(real(resolveShipRoot(env, worktree, 'git commit -m x')), real(worktree));
  assert.equal(real(resolveShipRoot(env, worktree, `cd ${worktree} && git commit -m x`)), real(worktree));
  assert.equal(real(resolveShipRoot(env, worktree, `git -C ${worktree} commit -m x`)), real(worktree));
});

test('a command whose target cannot be read for certain keeps the guard root', () => {
  const { main, worktree } = repoWithWorktree();
  const env = { CLAUDE_PROJECT_DIR: main };
  // A link inside the worktree pointing into main: `l/..` is the worktree lexically, main to git.
  fs.mkdirSync(path.join(main, 'src'));
  fs.symlinkSync(path.join(main, 'src'), path.join(worktree, 'l'));
  for (const command of [
    'eval "$(printf %s Y2Q=)"; git commit -m x',
    `cd $(echo ${main}) && git commit -m x`,
    'cd "$MAIN" && git commit -m x',
    `bash -c "cd ${main} && git commit -m x"`,
    `git --git-dir=${main}/.git --work-tree=${main} commit -m x`,
    `GIT_DIR=${main}/.git git commit -m x`,
    `pushd ${main} && git commit -m x`,
    'cd ~/elsewhere && git commit -m x',
    `cd ${worktree} && git -C ${main} commit -m x`,
    'cd /nonexistent/dir && git commit -m x',
    `git -c core.worktree=${main} commit -m x`,
    `env --chdir=${main} git commit -m x`,
    'cd && git commit -m x',
    'git -C l/.. commit -m x',
    'cd l/.. && git commit -m x',
  ]) {
    assert.equal(resolveShipRoot(env, worktree, command), main, command);
  }
});

test('an unrelated repository or a directory outside git cannot move the ship root', () => {
  const { main } = repoWithWorktree();
  const other = tempDir('ship-root-other-');
  git(other, 'init', '-q');
  assert.equal(resolveShipRoot({ CLAUDE_PROJECT_DIR: main }, other), main);
  assert.equal(resolveShipRoot({ CLAUDE_PROJECT_DIR: main }, tempDir('ship-root-none-')), main);
  assert.equal(resolveShipRoot({ CLAUDE_PROJECT_DIR: path.join(main, 'gone') }, main), null);
});

test('pre-ship.cjs judges the worktree a commit runs in, not the main checkout', () => {
  const { main, worktree } = repoWithWorktree();
  // The main checkout has nothing staged, so judged there the commit has nothing to check.
  // The worktree stages a ship-capable file and has no plan pointer, so judged there it blocks.
  write(worktree, 'src/a.ts', 'export const a = 1;\n');
  git(worktree, 'add', 'src/a.ts');

  const stdin = JSON.stringify({
    hook_event_name: 'PreToolUse',
    cwd: worktree,
    tool_name: 'Bash',
    tool_input: { command: 'git commit -m x' },
  });
  const result = spawnSync(process.execPath, [path.join(HOOKS, 'pre-ship.cjs')], {
    input: stdin,
    encoding: 'utf8',
    cwd: worktree,
    env: { PATH: process.env.PATH, HOME: worktree, CLAUDE_PROJECT_DIR: main },
  });
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /src\/a\.ts/);
  assert.match(result.stderr, /no active-plan pointer/);
});
