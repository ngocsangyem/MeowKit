// Ship-command parser, changed-file scope and run-once marker — lib/ship-command.cjs,
// lib/changed-files.cjs, lib/ship-run-once.cjs.
//
// Run with: node --test .claude/hooks/__tests__/

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { parseShipCommand } = require('../lib/ship-command.cjs');
const { changedFiles } = require('../lib/changed-files.cjs');
const { runOnce } = require('../lib/ship-run-once.cjs');

function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ship-cmd-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  git('init', '-q');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 't');
  fs.writeFileSync(path.join(dir, 'a.txt'), 'a\n');
  git('add', '-A');
  git('commit', '-qm', 'base');
  return { dir, git };
}

const kind = (command, root = '') => (parseShipCommand(command, { root }) || {}).kind || null;

test('the six forms the literal trigger missed are ship commands', () => {
  assert.equal(kind('git  commit -m x'), 'commit');
  assert.equal(kind('git -C . commit -m x'), 'commit');
  assert.equal(kind('git -c x=y commit -m x'), 'commit');
  assert.equal(kind('gh pr create --fill'), 'pr-create');
  assert.equal(kind('gh pr merge 1'), 'pr-merge');
  const { dir, git } = repo();
  git('config', 'alias.ci', 'commit');
  assert.equal(kind('git ci -m x', dir), 'commit');
});

test('literal forms, wrappers and chains are ship commands', () => {
  assert.equal(kind('git commit -m x'), 'commit');
  assert.equal(kind('git push --force'), 'push');
  assert.equal(kind('cd sub && git merge main'), 'merge');
  assert.equal(kind('FOO=1 env git push'), 'push');
  assert.equal(kind('/usr/bin/git commit'), 'commit');
  assert.equal(kind('git --git-dir .git --work-tree . commit'), 'commit');
  assert.equal(kind('gh -R owner/repo pr create'), 'pr-create');
});

test('shell keywords, grouping words and wrapper options in front of git do not hide a ship command', () => {
  const cases = [
    ['if true; then git commit -m x; fi', 'commit'],
    ['if git commit -m x; then echo ok; fi', 'commit'],
    ['while true; do git push; done', 'push'],
    ['{ git commit -m x; }', 'commit'],
    ['! git commit -m x', 'commit'],
    ['( git commit -m x )', 'commit'],
    ['time -p git push', 'push'],
    ['env -u X git push', 'push'],
    ['env -i PATH=/bin git push', 'push'],
    ['nice -n 5 git push', 'push'],
    ['sudo -u bob git push', 'push'],
    ['sudo -E -- git push', 'push'],
    ['xargs git commit', 'commit'],
    ['echo m | xargs -I {} git commit -m {}', 'commit'],
    ['xargs -n 1 gh pr merge', 'pr-merge'],
  ];
  for (const [command, expected] of cases) assert.equal(kind(command), expected, command);
});

test('a ship command inside bash -c, eval, env -S or backticks is not seen, as documented', () => {
  for (const c of ['bash -c "git push"', 'eval "git push"', 'env -S "git push"', 'echo `git push`', 'command -v git']) {
    assert.equal(kind(c), null, c);
  }
});

test('a shell alias is parsed as a command line', () => {
  const { dir, git } = repo();
  git('config', 'alias.ship', '!git add -A && git commit -m wip');
  assert.equal(kind('git ship', dir), 'commit');
});

test('everything else is not a ship command', () => {
  for (const c of ['git status', 'git log | head', 'echo "git commit"', 'gh pr view 1', 'npm test', '', 'git commit-tree x']) {
    assert.equal(kind(c), null, c);
  }
});

test('a commit ships the staged set; -a adds modified tracked files', () => {
  const { dir, git } = repo();
  fs.writeFileSync(path.join(dir, 'b.txt'), 'b\n');
  git('add', 'b.txt');
  fs.writeFileSync(path.join(dir, 'a.txt'), 'changed\n');
  assert.deepEqual(changedFiles(dir, { kind: 'commit', args: [] }), { files: ['b.txt'], rangeKnown: true });
  assert.deepEqual(changedFiles(dir, { kind: 'commit', args: ['-am', 'x'] }).files.sort(), ['a.txt', 'b.txt']);
});

test('a push with no upstream and no origin/HEAD has an unknown range', () => {
  const { dir } = repo();
  assert.deepEqual(changedFiles(dir, { kind: 'push', args: [] }), { files: [], rangeKnown: false });
});

test('a second run for the same command and tree state reports the first result', () => {
  const { dir } = repo();
  let runs = 0;
  const check = () => {
    runs += 1;
    return { exit: 0, stdout: ['ran'], stderr: [] };
  };
  assert.equal(runOnce(dir, 'git commit -m x', 5000, check).exit, 0);
  const second = runOnce(dir, 'git commit -m x', 5000, check);
  assert.equal(runs, 1);
  assert.equal(second.exit, 0);
  assert.match(second.stdout[0], /already ran/);
  runOnce(dir, 'git commit -m y', 5000, check);
  assert.equal(runs, 2, 'a different command runs the check again');
});
