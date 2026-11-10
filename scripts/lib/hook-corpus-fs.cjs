'use strict';
// hook-corpus-fs.cjs — file-tree and git builders for the BASE hook golden corpus.
//
// Every case gets a fresh throwaway "project": a copy of the extracted BASE
// hook tree plus whatever plans, contracts, verdicts, state files or git
// history that case needs. Artifact bodies live in hook-corpus-content.cjs.

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const { pinnedEnv } = require('./hook-corpus-env.cjs');

/** Write `content` to `rel` inside `root`, creating parent directories. */
function writeFile(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
}

/** Remove `rel` inside `root` if present — used to record "a required lib is absent". */
function removePath(root, rel) {
  fs.rmSync(path.join(root, rel), { recursive: true, force: true });
}

/**
 * Remove a library by its extension-less path, so one case definition expresses
 * "this library is absent" for whichever implementation the tree under test
 * holds. The recorder runs against the shell tree and the replay harness against
 * the node tree; without this the two would delete different files and the case
 * would stop testing the same thing.
 */
function removeLib(ctx, relWithoutExt) {
  removePath(ctx.projectDir, `${relWithoutExt}${ctx.ext || '.sh'}`);
}

/** Copy the extracted BASE tree into a fresh project directory. */
function newProject(baseTree, projectDir) {
  fs.mkdirSync(projectDir, { recursive: true });
  fs.cpSync(baseTree, projectDir, { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'home'), { recursive: true });
  return projectDir;
}

/** Deterministic mtimes: gate-enforcement picks the newest plan by mtime. */
function setMtime(root, rel, epochSeconds) {
  const abs = path.join(root, rel);
  fs.utimesSync(abs, epochSeconds, epochSeconds);
}

function git(projectDir, args, home) {
  return execFileSync('git', args, {
    cwd: projectDir,
    env: pinnedEnv(home),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/**
 * Initialise a git repo with one commit, then optionally stage more files.
 * The pinned identity and dates in `pinnedEnv` make the resulting SHAs stable,
 * which the Gate 2 revision-binding fixtures depend on.
 */
function initGit(projectDir, home, { commit = [], stage = [], untracked = [] } = {}) {
  git(projectDir, ['init', '-q', '-b', 'main'], home);
  // Keep .claude out of history so the hook tree never shows up as a change.
  writeFile(projectDir, '.gitignore', '.claude/\nhome/\nnode_modules/\n');
  for (const [rel, content] of commit) writeFile(projectDir, rel, content);
  git(projectDir, ['add', '-A'], home);
  git(projectDir, ['commit', '-q', '-m', 'base'], home);
  for (const [rel, content] of stage) writeFile(projectDir, rel, content);
  if (stage.length) git(projectDir, ['add', ...stage.map(([rel]) => rel)], home);
  for (const [rel, content] of untracked) writeFile(projectDir, rel, content);
  return git(projectDir, ['rev-parse', '--short', 'HEAD'], home).trim();
}

/**
 * Stamp a fresh approval receipt using the helper in the tree under test, so the
 * stored hash is produced by the same code the gate verifies with.
 *
 * The two implementations are reached differently: the shell one is a CLI
 * invoked with `sh` (its file is mode 644, which is also how the gate calls it),
 * and the node one is a library loaded in a child process. Hard-coding either
 * would make this helper work for one tree and silently fail for the other.
 */
function stampApproval(ctx, planRel) {
  const run = (command, args) =>
    execFileSync(command, args, {
      cwd: ctx.projectDir,
      env: pinnedEnv(ctx.home),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

  if ((ctx.ext || '.sh') === '.cjs') {
    const lib = path.join(ctx.projectDir, '.claude/hooks/lib/approval-receipt.cjs');
    run(process.execPath, ['-e', `require(${JSON.stringify(lib)}).stamp(${JSON.stringify(planRel)}, "human")`]);
    return;
  }
  run('sh', [path.join(ctx.projectDir, '.claude/hooks/lib/approval-receipt.sh'), 'stamp', planRel, 'human']);
}

/** Stamp an approval and then edit the body, so the stored plan_hash goes stale. */
function stampThenEdit(ctx, planRel) {
  stampApproval(ctx, planRel);
  fs.appendFileSync(path.join(ctx.projectDir, planRel), '\nAn edit made after approval.\n');
}

/** A node stub standing in for the resolved mewkit CLI (`MEOWKIT_CLI`). */
function writeFakeCli(projectDir, rel, { exitCode, output }) {
  const abs = writeFile(
    projectDir,
    rel,
    ['#!/usr/bin/env node', `process.stdout.write(${JSON.stringify(output)});`, `process.exit(${exitCode});`, ''].join('\n'),
  );
  fs.chmodSync(abs, 0o755);
  return abs;
}

module.exports = {
  git,
  initGit,
  newProject,
  removeLib,
  removePath,
  setMtime,
  stampApproval,
  stampThenEdit,
  writeFakeCli,
  writeFile,
  ...require('./hook-corpus-content.cjs'),
};
