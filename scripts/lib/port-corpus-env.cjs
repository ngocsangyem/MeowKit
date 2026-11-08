'use strict';
// port-corpus-env.cjs — deterministic execution environment for the corpus that
// pins the behavior of the two interpreter-dependent CLIs before they are
// reimplemented on node (`.claude/scripts/injection-audit.py` and
// `.claude/scripts/bin/workflow-config`).
//
// The hook corpus already solved "run one case under a pinned environment and
// normalize what varies" (hook-corpus-env.cjs). That machinery is reused rather
// than copied, so a change to the pinned locale, timezone, HOME or git identity
// cannot drift between the two corpora. Only two things are added here:
//
//   1. A narrower set of git pathspecs. This corpus needs the audit scanner and
//      the config CLI, not the whole hook tree, and a smaller extract keeps the
//      scanned directory fixtures free of unrelated files.
//   2. An extra normalizer for the security-log stamp the audit emits, which
//      the hook corpus has no reason to know about.

const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const { NORMALIZERS: HOOK_NORMALIZERS, runScript } = require('./hook-corpus-env.cjs');

/**
 * Interpreters to try, newest name first, across the directories a developer
 * machine keeps them in.
 *
 * The hook corpus pins PATH with `/usr/bin` first, where macOS ships 3.9.6. The
 * audit scanner's own docstring says "Python 3.9+", but its annotations use the
 * 3.10 union syntax and are evaluated at definition time, so under that PATH it
 * raises TypeError before `main` is reached. Recording that traceback would pin
 * a crash as the behavior the port has to reproduce, so the recorder resolves an
 * interpreter that can actually load the subject and writes which one it used
 * into the corpus index.
 */
const PYTHON_CANDIDATES = ['python3', 'python3.15', 'python3.14', 'python3.13', 'python3.12', 'python3.11', 'python3.10'];
const PYTHON_SEARCH_PATH = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'];
const MINIMUM_PYTHON = [3, 10];

/** The first candidate interpreter new enough to load the recorded subject. */
function resolvePython() {
  const probe = 'import sys; print("%d.%d.%d" % sys.version_info[:3])';
  for (const name of PYTHON_CANDIDATES) {
    for (const dir of PYTHON_SEARCH_PATH) {
      const bin = path.join(dir, name);
      if (!fs.existsSync(bin)) continue;
      const out = spawnSync(bin, ['-c', probe], { encoding: 'utf8' });
      if (out.status !== 0 || typeof out.stdout !== 'string') continue;
      const version = out.stdout.trim();
      const [major, minor] = version.split('.').map(Number);
      if (major > MINIMUM_PYTHON[0] || (major === MINIMUM_PYTHON[0] && minor >= MINIMUM_PYTHON[1])) {
        return { bin, version, dir };
      }
    }
  }
  throw new Error(`no python3 >= ${MINIMUM_PYTHON.join('.')} found in ${PYTHON_SEARCH_PATH.join(', ')}; cannot record the corpus`);
}

/** Everything a case in this corpus invokes or imports. */
const BASE_PATHSPECS = ['.claude/scripts', '.claude/skills/web-to-markdown', '.claude/skills/story-sizer'];

/**
 * Normalizers for this corpus, on top of the hook corpus set (`tmpdir`,
 * `homedir`, ...). Each one is opt-in per case and recorded in the fixture's
 * `normalizers` field, so a reader can see which substitutions a comparison
 * allowed.
 */
const NORMALIZERS = {
  ...HOOK_NORMALIZERS,
  // The security log's own stamp — `date +%y%m%d-%H%M%S`, i.e. wall clock.
  logStamp: (text) => text.replace(/\d{6}-\d{6}/g, '{{STAMP}}'),
};

function applyNormalizers(text, names, ctx) {
  let out = text;
  for (const name of names) {
    const fn = NORMALIZERS[name];
    if (!fn) throw new Error(`unknown normalizer: ${name}`);
    out = fn(out, ctx);
  }
  return out;
}

/**
 * Extract the pinned tree out of git into a throwaway directory, so the recorder
 * never reads the working tree and the corpus can be re-recorded from the
 * pinned commit after the implementations it recorded are gone.
 */
function extractBase(repoRoot, baseSha, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const archive = execFileSync('git', ['archive', baseSha, '--', ...BASE_PATHSPECS], {
    cwd: repoRoot,
    maxBuffer: 256 * 1024 * 1024,
  });
  const tar = spawnSync('tar', ['-x', '-C', destDir], { input: archive });
  if (tar.status !== 0) throw new Error(`tar -x failed: ${tar.stderr && tar.stderr.toString()}`);
  return destDir;
}

/** A fresh throwaway project holding a copy of the extracted tree. */
function newProject(baseTree, projectDir) {
  fs.mkdirSync(projectDir, { recursive: true });
  fs.cpSync(baseTree, projectDir, { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'home'), { recursive: true });
  return projectDir;
}

/** Write `content` to `rel` inside `root`, creating parent directories. */
function writeFile(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
}

module.exports = {
  BASE_PATHSPECS,
  MINIMUM_PYTHON,
  NORMALIZERS,
  applyNormalizers,
  extractBase,
  newProject,
  resolvePython,
  runScript,
  writeFile,
};
