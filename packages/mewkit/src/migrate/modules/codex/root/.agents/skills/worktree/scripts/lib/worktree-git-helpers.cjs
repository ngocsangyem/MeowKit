#!/usr/bin/env node
/**
 * Git utility helpers for worktree.cjs
 * Extracted to keep the main script under the modularization limit.
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── Sanitization ────────────────────────────────────────────────────────────

function sanitizeBranchPrefix(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'feat';
  const safe = raw
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 20);
  return safe || 'feat';
}

function isSafeEnvFileName(fileName) {
  if (!fileName || typeof fileName !== 'string') return false;
  if (fileName.includes('\0')) return false;
  if (path.isAbsolute(fileName)) return false;
  const normalized = path.normalize(fileName.trim());
  if (normalized.startsWith('..') || normalized.includes(`..${path.sep}`)) return false;
  if (normalized.includes(path.sep)) return false;
  return /^\.env[\w.-]*$/.test(normalized);
}

function sanitizeBaseBranch(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('-')) return { error: 'LOOKS_LIKE_FLAG', value: trimmed };
  if (/[;|&$`()\n\r\0\\'"<>]/.test(trimmed)) return { error: 'SHELL_CHARS', value: trimmed };
  if (!/^[a-zA-Z0-9_./:~^@-]+$/.test(trimmed)) return { error: 'INVALID_CHARS', value: trimmed };
  return trimmed;
}

function sanitizeFeatureName(name, preserveCase = false) {
  const raw = String(name || '').trim();
  if (!raw) return '';

  let ascii = raw.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  if (!preserveCase) ascii = ascii.toLowerCase();

  if (preserveCase && ascii.split('/').some(seg => seg === '..')) return '';

  ascii = ascii
    .replace(preserveCase ? /[^a-zA-Z0-9/.-]/g : /[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (preserveCase) {
    ascii = ascii.replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
    ascii = ascii.replace(/-?\/-?/g, '/');
  }

  ascii = ascii.slice(0, preserveCase ? 80 : 50);
  if (ascii) return ascii;

  if (/[\p{L}\p{N}]/u.test(raw)) {
    const hash = crypto.createHash('sha1').update(raw).digest('hex').slice(0, 8);
    return `feature-${hash}`;
  }
  return '';
}

function flattenForDirectoryName(branchSegment) {
  return branchSegment.replace(/\//g, '-');
}

// ─── Git command wrapper ─────────────────────────────────────────────────────

function git(command, options = {}) {
  try {
    const result = execSync(`git ${command}`, {
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : ['pipe', 'pipe', 'pipe'],
      cwd: options.cwd || process.cwd()
    });
    return { success: true, output: result.trim() };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stderr: error.stderr?.toString().trim() || '',
      code: error.status
    };
  }
}

// ─── Repo introspection ──────────────────────────────────────────────────────

function checkGitRepo(outputError) {
  const result = git('rev-parse --show-toplevel', { silent: true });
  if (!result.success) {
    outputError('NOT_GIT_REPO', 'Not in a git repository', {
      suggestion: 'Run this command from within a git repository'
    });
  }
  return result.output;
}

function checkGitVersion(outputError) {
  const result = git('worktree list', { silent: true });
  if (!result.success && result.stderr.includes('not a git command')) {
    outputError('GIT_VERSION_ERROR', 'Git version too old (worktree requires git 2.5+)', {
      suggestion: 'Upgrade git to version 2.5 or newer'
    });
  }
}

function detectBaseBranch(cwd) {
  const branches = ['dev', 'develop', 'main', 'master'];
  for (const branch of branches) {
    const local = git(`show-ref --verify --quiet refs/heads/${branch}`, { silent: true, cwd });
    if (local.success) return branch;
    const remote = git(`show-ref --verify --quiet refs/remotes/origin/${branch}`, { silent: true, cwd });
    if (remote.success) return branch;
  }
  return 'main';
}

const MAX_SUPERPROJECT_DEPTH = 10;

function findTopmostSuperproject(gitRoot) {
  let current = gitRoot;
  let topmost = gitRoot;
  let depth = 0;
  while (depth < MAX_SUPERPROJECT_DEPTH) {
    const result = git('rev-parse --show-superproject-working-tree', { silent: true, cwd: current });
    if (!result.success || !result.output) break;
    topmost = result.output;
    current = result.output;
    depth++;
  }
  return topmost;
}

function validateWorktreeRoot(rootPath) {
  if (typeof rootPath !== 'string' || rootPath.trim().length === 0) {
    return { valid: false, error: 'Worktree root path is empty' };
  }
  if (/[\0\r\n]/.test(rootPath)) {
    return { valid: false, error: 'Worktree root contains invalid control characters' };
  }
  const resolved = path.resolve(rootPath);
  if (fs.existsSync(resolved)) {
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      return { valid: false, error: `Path exists but is not a directory: ${resolved}` };
    }
    return { valid: true, path: resolved };
  }
  const parent = path.dirname(resolved);
  if (fs.existsSync(parent)) {
    const parentStat = fs.statSync(parent);
    if (!parentStat.isDirectory()) {
      return { valid: false, error: `Parent path is not a directory: ${parent}` };
    }
    return { valid: true, path: resolved };
  }
  const grandparent = path.dirname(parent);
  if (fs.existsSync(grandparent)) return { valid: true, path: resolved };
  return { valid: false, error: `Cannot create worktree directory: parent path does not exist: ${parent}` };
}

function getWorktreeRoot(gitRoot, isMonorepo, explicitRoot, orchestratedDir, outputError) {
  // Orchestrated mode always uses .worktrees/ inside repo root (parallel-execution-rules Rule 3)
  if (orchestratedDir) return { dir: orchestratedDir, source: 'orchestrated (.worktrees/)' };

  if (explicitRoot) {
    const validation = validateWorktreeRoot(explicitRoot);
    if (!validation.valid) {
      outputError('INVALID_WORKTREE_ROOT', validation.error, {
        suggestion: 'Provide a valid directory path that exists or can be created'
      });
    }
    return { dir: validation.path, source: '--worktree-root flag' };
  }

  const envRoot = process.env.WORKTREE_ROOT;
  if (envRoot) {
    const validation = validateWorktreeRoot(envRoot);
    if (!validation.valid) {
      outputError('INVALID_WORKTREE_ROOT', validation.error, {
        suggestion: 'Fix WORKTREE_ROOT env var or unset it'
      });
    }
    return { dir: validation.path, source: 'WORKTREE_ROOT env' };
  }

  const topmostRoot = findTopmostSuperproject(gitRoot);
  if (topmostRoot !== gitRoot) {
    return {
      dir: path.join(topmostRoot, 'worktrees'),
      source: `superproject (${path.basename(topmostRoot)})`
    };
  }

  if (isMonorepo) return { dir: path.join(gitRoot, 'worktrees'), source: 'monorepo internal' };
  return { dir: path.join(path.dirname(gitRoot), 'worktrees'), source: 'sibling directory' };
}

// ─── Dirty state ─────────────────────────────────────────────────────────────

function checkDirtyState(cwd = process.cwd()) {
  const diff = git('diff --quiet', { silent: true, cwd });
  const diffCached = git('diff --cached --quiet', { silent: true, cwd });
  return !diff.success || !diffCached.success;
}

function getDirtyStateDetails(cwd = process.cwd()) {
  const status = git('status --porcelain', { silent: true, cwd });
  if (!status.success) return null;
  const lines = status.output.split('\n').filter(Boolean);
  const modified = lines.filter(l => l.startsWith(' M') || l.startsWith('M ')).length;
  const staged = lines.filter(l => l.startsWith('A ') || l.startsWith('M ') || l.startsWith('D ')).length;
  const untracked = lines.filter(l => l.startsWith('??')).length;
  return { modified, staged, untracked, total: lines.length };
}

// ─── Branch / worktree queries ────────────────────────────────────────────────

function branchExists(branchName, cwd) {
  const local = git(`show-ref --verify --quiet refs/heads/${branchName}`, { silent: true, cwd });
  if (local.success) return 'local';
  const remote = git(`show-ref --verify --quiet refs/remotes/origin/${branchName}`, { silent: true, cwd });
  if (remote.success) return 'remote';
  return false;
}

function isBranchCheckedOut(branchName, cwd) {
  const result = git('worktree list --porcelain', { silent: true, cwd });
  if (!result.success) return false;
  return result.output.includes(`branch refs/heads/${branchName}`);
}

function getGitCommonDir(cwd) {
  const result = git('rev-parse --git-common-dir', { silent: true, cwd });
  if (!result.success || !result.output) return null;
  return path.resolve(cwd, result.output);
}

function getMainWorktreePath(gitRoot, cwd) {
  const gitCommonDir = getGitCommonDir(cwd);
  if (!gitCommonDir) return gitRoot;
  const configResult = git(`config --file "${gitCommonDir}/config" --get core.worktree`, { silent: true, cwd });
  if (!configResult.success || !configResult.output) return gitRoot;
  return path.resolve(gitCommonDir, configResult.output);
}

function parseWorktreeListPorcelain(output, options = {}) {
  const gitCommonDir = options.gitCommonDir ? path.resolve(options.gitCommonDir) : null;
  const mainWorktreePath = options.mainWorktreePath ? path.resolve(options.mainWorktreePath) : null;
  const worktrees = [];
  let current = null;

  output.split('\n').map(line => line.replace(/\r$/, '')).forEach(line => {
    if (!line) {
      if (current && current.path) worktrees.push(current);
      current = null;
      return;
    }
    if (line.startsWith('worktree ')) {
      if (current && current.path) worktrees.push(current);
      current = {
        adminPath: line.slice('worktree '.length),
        path: line.slice('worktree '.length),
        commit: null, branch: 'detached',
        bare: false, detached: false, locked: false, prunable: false
      };
      return;
    }
    if (!current) return;
    if (line.startsWith('HEAD ')) { current.commit = line.slice('HEAD '.length); return; }
    if (line.startsWith('branch ')) { current.branch = line.replace('branch refs/heads/', ''); return; }
    if (line === 'bare') { current.bare = true; current.branch = 'bare'; return; }
    if (line === 'detached') { current.detached = true; current.branch = 'detached'; return; }
    if (line.startsWith('locked')) { current.locked = true; current.lockReason = line.slice('locked'.length).trim() || null; return; }
    if (line.startsWith('prunable')) { current.prunable = true; current.prunableReason = line.slice('prunable'.length).trim() || null; }
  });

  if (current && current.path) worktrees.push(current);

  return worktrees.map(worktree => {
    const normalizedAdminPath = path.resolve(worktree.adminPath);
    const normalizedPath = gitCommonDir && mainWorktreePath && normalizedAdminPath === gitCommonDir
      ? mainWorktreePath
      : path.resolve(worktree.path);
    return { ...worktree, path: normalizedPath, isMainWorktree: mainWorktreePath ? normalizedPath === mainWorktreePath : false };
  });
}

function getWorktreeRecords(gitRoot, cwd, outputError) {
  const result = git('worktree list --porcelain', { silent: true, cwd });
  if (!result.success) {
    outputError('WORKTREE_LIST_ERROR', 'Failed to list worktrees', {
      suggestion: 'Ensure you are in a git repository'
    });
  }
  return parseWorktreeListPorcelain(result.output, {
    gitCommonDir: getGitCommonDir(cwd),
    mainWorktreePath: getMainWorktreePath(gitRoot, cwd)
  });
}

function getAheadBehind(branchName, baseBranch, cwd) {
  if (!branchName || !baseBranch || branchName === 'detached' || branchName === 'bare') {
    return { ahead: 0, behind: 0 };
  }
  const result = git(`rev-list --left-right --count "${branchName}...${baseBranch}"`, { silent: true, cwd });
  if (!result.success || !result.output) return { ahead: 0, behind: 0 };
  const [ahead, behind] = result.output.trim().split(/\s+/).map(v => Number.parseInt(v, 10));
  return {
    ahead: Number.isFinite(ahead) ? ahead : 0,
    behind: Number.isFinite(behind) ? behind : 0
  };
}

// ─── File / module helpers ───────────────────────────────────────────────────

function parseGitModules(gitRoot) {
  const modulesPath = path.join(gitRoot, '.gitmodules');
  if (!fs.existsSync(modulesPath)) return [];
  const content = fs.readFileSync(modulesPath, 'utf-8');
  const projects = [];
  const pathRegex = /path\s*=\s*(.+)/g;
  let match;
  while ((match = pathRegex.exec(content)) !== null) {
    const projectPath = match[1].trim();
    projects.push({ path: projectPath, name: path.basename(projectPath) });
  }
  return projects;
}

function findEnvFiles(dir) {
  try {
    const files = fs.readdirSync(dir);
    return files.filter(f => {
      if (!f.startsWith('.env')) return false;
      const stat = fs.statSync(path.join(dir, f));
      return stat.isFile() && !stat.isSymbolicLink();
    });
  } catch { return []; }
}

function findEnvTemplates(dir) {
  try {
    const files = fs.readdirSync(dir);
    return files.filter(f => {
      if (!f.startsWith('.env') || !f.endsWith('.example')) return false;
      const stat = fs.statSync(path.join(dir, f));
      return stat.isFile() && !stat.isSymbolicLink();
    });
  } catch { return []; }
}

function copyEnvTemplates(srcDir, destDir) {
  const templates = findEnvTemplates(srcDir);
  const copied = [];
  const warnings = [];
  templates.forEach(template => {
    const srcPath = path.join(srcDir, template);
    const destName = template.replace(/\.example$/, '');
    const destPath = path.join(destDir, destName);
    try {
      fs.copyFileSync(srcPath, destPath);
      copied.push({ from: template, to: destName });
    } catch (err) {
      warnings.push(`Failed to copy ${template}: ${err.message}`);
    }
  });
  return { copied, warnings };
}

function findMatchingProjects(projects, query) {
  const queryLower = query.toLowerCase();
  return projects.filter(p =>
    p.name.toLowerCase().includes(queryLower) ||
    p.path.toLowerCase().includes(queryLower)
  );
}

module.exports = {
  sanitizeBranchPrefix,
  isSafeEnvFileName,
  sanitizeBaseBranch,
  sanitizeFeatureName,
  flattenForDirectoryName,
  git,
  checkGitRepo,
  checkGitVersion,
  detectBaseBranch,
  findTopmostSuperproject,
  validateWorktreeRoot,
  getWorktreeRoot,
  checkDirtyState,
  getDirtyStateDetails,
  branchExists,
  isBranchCheckedOut,
  getGitCommonDir,
  getMainWorktreePath,
  parseWorktreeListPorcelain,
  getWorktreeRecords,
  getAheadBehind,
  parseGitModules,
  findEnvFiles,
  findEnvTemplates,
  copyEnvTemplates,
  findMatchingProjects
};
