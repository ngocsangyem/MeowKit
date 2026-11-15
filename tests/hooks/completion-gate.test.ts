// completion-gate.test.ts — the opt-in Stop-time completion check.
//
// Off by default. When switched on, a stop with files changed since the session's last
// passing verification command asks for one more turn, at most twice, then ends with a
// notice. Edits are read from the working tree, so one made through the shell counts.

import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require_ = createRequire(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

type Ctx = { root: string; session_id?: string; event?: string; tool_input?: { command?: string }; stop_hook_active?: boolean };
type Result = { stdout?: string; feedback?: boolean } | null;
type Handler = (ctx: Ctx) => Result;

function load(rel: string): Handler {
  const mod: unknown = require_(path.join(REPO_ROOT, '.claude/hooks', rel));
  if (typeof mod !== 'function') throw new Error(`${rel} does not export a handler`);
  return mod as Handler;
}

const stop = load('handlers/pre-completion-check.cjs');
const evidence = load('handlers/verification-evidence.cjs');
const core = require_(path.join(REPO_ROOT, '.claude/hooks/lib/core/completion-check.cjs')) as {
  classifyCommand(command: string): string | null;
};

const made: string[] = [];
const savedHome = process.env.HOME;
afterEach(() => {
  process.env.HOME = savedHome;
  for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

/** A git project with the observer registry; the check is on unless `enabled` is false. */
function project({ enabled = true, git = true } = {}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-completion-'));
  made.push(dir);
  process.env.HOME = dir;
  fs.mkdirSync(path.join(dir, '.claude/hooks'), { recursive: true });
  fs.copyFileSync(path.join(REPO_ROOT, '.claude/hooks/handlers.json'), path.join(dir, '.claude/hooks/handlers.json'));
  fs.mkdirSync(path.join(dir, '.meowkit'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.gitignore'), '.meowkit/state/\n');
  if (enabled) fs.writeFileSync(path.join(dir, '.meowkit/config.yaml'), 'hooks:\n  pre-completion-check: true\n');
  fs.writeFileSync(path.join(dir, 'app.ts'), 'export const a = 1;\n');
  if (git) {
    const run = (...args: string[]) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
    run('init', '-q');
    run('-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '-A');
    run('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init');
  }
  return dir;
}

const start = (root: string, session = 's1') => evidence({ root, session_id: session, event: 'SessionStart' });
const ran = (root: string, command: string, session = 's1') =>
  evidence({ root, session_id: session, event: 'PostToolUse', tool_input: { command } });
const stopAt = (root: string, session = 's1') => stop({ root, session_id: session, event: 'Stop' });
const edit = (root: string, text = 'export const a = 2;\n') => fs.writeFileSync(path.join(root, 'app.ts'), text);
const decision = (r: Result) => (r && r.stdout ? JSON.parse(r.stdout) : null);

describe('the completion check is off by default', () => {
  it('never blocks without the config switch', () => {
    const root = project({ enabled: false });
    start(root);
    edit(root);
    expect(stopAt(root)).toBeNull();
    expect(fs.existsSync(path.join(root, '.meowkit/state/completion-evidence.json'))).toBe(false);
  });

  it('does not arm outside a git repository', () => {
    const root = project({ git: false });
    start(root);
    edit(root);
    expect(stopAt(root)).toBeNull();
  });
});

describe('the completion check, switched on', () => {
  it('allows a stop when nothing changed since the session started', () => {
    const root = project();
    start(root);
    expect(stopAt(root)).toBeNull();
  });

  it('does not count changes already in the tree when the session began', () => {
    const root = project();
    edit(root, 'export const before = 1;\n');
    start(root);
    expect(stopAt(root)).toBeNull();
  });

  it('arms on an unverified edit and blocks with a reason the host feeds back', () => {
    const root = project();
    start(root);
    edit(root);
    const r = stopAt(root);
    expect(r?.feedback).toBe(true);
    expect(decision(r)).toMatchObject({ decision: 'block' });
    expect(decision(r).reason).toMatch(/last passing test, build, lint or type-check/);
  });

  it('counts an edit made through the shell, with no edit hook involved', () => {
    const root = project();
    start(root);
    execFileSync('sh', ['-c', 'echo "export const b = 3;" > shell-made.ts'], { cwd: root });
    expect(decision(stopAt(root))).toMatchObject({ decision: 'block' });
  });

  it('releases once a verification command passes after the edit', () => {
    const root = project();
    start(root);
    edit(root);
    ran(root, 'npm test');
    expect(stopAt(root)).toBeNull();
  });

  it('arms again when files change after the pass', () => {
    const root = project();
    start(root);
    ran(root, 'npx vitest run');
    edit(root);
    expect(decision(stopAt(root))).toMatchObject({ decision: 'block' });
  });

  it('blocks at most twice, then ends the session with one notice', () => {
    const root = project();
    start(root);
    edit(root);
    expect(decision(stopAt(root))).toMatchObject({ decision: 'block' });
    expect(decision(stopAt(root))).toMatchObject({ decision: 'block' });
    expect(decision(stopAt(root)).systemMessage).toMatch(/still unverified after 2 reminders/);
    expect(stopAt(root)).toBeNull();
  });

  it('gives a new session no pass and no spent reminders from the last one', () => {
    const root = project();
    start(root, 's1');
    edit(root);
    ran(root, 'npm test', 's1');
    start(root, 's2');
    edit(root, 'export const a = 9;\n');
    expect(decision(stopAt(root, 's2'))).toMatchObject({ decision: 'block' });
  });

  it('is satisfied by a trivial passing command: evidence of effort, not proof', () => {
    const root = project();
    start(root);
    edit(root);
    ran(root, 'node --test --test-name-pattern=nothing-matches');
    expect(stopAt(root)).toBeNull();
  });

  it('records no pass for a command that is not a verification runner', () => {
    const root = project();
    start(root);
    edit(root);
    ran(root, 'echo tests passed');
    expect(decision(stopAt(root))).toMatchObject({ decision: 'block' });
  });

  it('with the observer switched off, still blocks on edits after the first stop', () => {
    const root = project();
    fs.appendFileSync(path.join(root, '.meowkit/config.yaml'), '  verification-evidence: false\n');
    expect(stopAt(root)).toBeNull();
    edit(root);
    expect(decision(stopAt(root))).toMatchObject({ decision: 'block' });
  });
});

describe('which commands count as a verification pass', () => {
  it.each([
    ['npm test', 'test'],
    ['pnpm run test -- --run', 'test'],
    ['npx vitest run src', 'test'],
    ['cargo test --workspace', 'test'],
    ['CI=1 pytest -q', 'test'],
    ['cd pkg && go test ./...', 'test'],
    ['tsc --noEmit', 'typecheck'],
    ['npm run lint', 'lint'],
    ['cargo build', 'build'],
  ])('%s is %s', (command, cls) => {
    expect(core.classifyCommand(command)).toBe(cls);
  });

  it.each(['npm test | tail -5', 'npm test; true', 'npm test || true', 'npm test &', 'echo $(npm test)', 'git commit -m test', 'cat test.log'])(
    '%s is not a pass, because its exit status is not the runner\'s',
    (command) => {
      expect(core.classifyCommand(command)).toBeNull();
    },
  );
});
