#!/usr/bin/env node
/**
 * Git Worktree Manager for the toolkit
 *
 * Usage: node worktree.cjs <command> [options]
 * Commands:
 *   create <feature>           Create a new worktree
 *   create <agent> --orchestrated  Create a parallel agent worktree
 *   remove <name-or-path>      Remove a worktree and its branch
 *   info                       Get repo info (type, base branch, env files)
 *   list                       List existing worktrees
 *   status                     Show worktree health and branch status
 *   prune                      Remove stale worktree metadata
 *
 * Options:
 *   --prefix <type>        Branch prefix (feat|fix|refactor|docs|test|chore|perf)
 *   --base <branch>        Override auto-detected base branch
 *   --orchestrated         Create parallel agent worktree in .worktrees/{name}
 *   --checkout-submodules  Initialize submodules in the new worktree
 *   --worktree-root <path> Explicit worktree directory
 *   --json                 Output in JSON format for LLM consumption
 *   --env <files>          Comma-separated list of .env files to copy (legacy)
 *   --dry-run              Show what would be done without executing
 *   --no-prefix            Skip branch prefix and preserve original case
 */

'use strict';

const fs = require('fs');
const path = require('path');
const helpers = require('./lib/worktree-git-helpers.cjs');
const reviewPr = require('./lib/worktree-review-pr.cjs');

const {
  sanitizeBranchPrefix, isSafeEnvFileName, sanitizeBaseBranch,
  sanitizeFeatureName, flattenForDirectoryName,
  git, checkGitRepo, checkGitVersion, detectBaseBranch,
  getWorktreeRoot, checkDirtyState, getDirtyStateDetails,
  branchExists, isBranchCheckedOut, getWorktreeRecords,
  getAheadBehind, parseGitModules, findEnvFiles,
  copyEnvTemplates, findMatchingProjects
} = helpers;

// ─── Node version check ───────────────────────────────────────────────────────

const MIN_NODE_VERSION = 18;
const nodeVersion = parseInt(process.version.slice(1).split('.')[0], 10);
if (nodeVersion < MIN_NODE_VERSION) {
  // outputError not yet defined; write directly
  console.error(JSON.stringify({ success: false, error: { code: 'NODE_VERSION_ERROR', message: `Node.js ${MIN_NODE_VERSION}+ required. Current: ${process.version}` } }, null, 2));
  process.exit(1);
}

// ─── Argument parsing ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);

const jsonOutput = args.includes('--json');
const jsonIndex = args.indexOf('--json');
if (jsonIndex > -1) args.splice(jsonIndex, 1);

const prefixIndex = args.indexOf('--prefix');
let branchPrefix = 'feat';
let branchPrefixWarning = null;
if (prefixIndex > -1) {
  const rawPrefix = args[prefixIndex + 1] || 'feat';
  branchPrefix = sanitizeBranchPrefix(rawPrefix);
  if (branchPrefix !== rawPrefix.toLowerCase()) {
    branchPrefixWarning = `Branch prefix sanitized: "${rawPrefix}" → "${branchPrefix}"`;
  }
  args.splice(prefixIndex, 2);
}

const envIndex = args.indexOf('--env');
let envFilesToCopy = [];
if (envIndex > -1) {
  envFilesToCopy = (args[envIndex + 1] || '').split(',').map(v => v.trim()).filter(Boolean);
  args.splice(envIndex, 2);
}

const dryRunIndex = args.indexOf('--dry-run');
const dryRun = dryRunIndex > -1;
if (dryRunIndex > -1) args.splice(dryRunIndex, 1);

const noPrefixIndex = args.indexOf('--no-prefix');
const noPrefix = noPrefixIndex > -1;
if (noPrefixIndex > -1) args.splice(noPrefixIndex, 1);

// --orchestrated: parallel agent worktree mode (toolkit-specific)
const orchestratedIndex = args.indexOf('--orchestrated');
const orchestrated = orchestratedIndex > -1;
if (orchestratedIndex > -1) args.splice(orchestratedIndex, 1);

const worktreeRootIndex = args.indexOf('--worktree-root');
let explicitWorktreeRoot = null;
if (worktreeRootIndex > -1) {
  explicitWorktreeRoot = args[worktreeRootIndex + 1];
  args.splice(worktreeRootIndex, 2);
}

const baseIndex = args.indexOf('--base');
let explicitBase = null;
let explicitBaseError = null;
if (baseIndex > -1) {
  const rawBase = args[baseIndex + 1];
  const sanitized = sanitizeBaseBranch(rawBase);
  if (sanitized && typeof sanitized === 'object' && sanitized.error) {
    explicitBaseError = sanitized;
  } else {
    explicitBase = sanitized;
  }
  args.splice(baseIndex, 2);
}

const checkoutSubmodulesIndex = args.indexOf('--checkout-submodules');
const checkoutSubmodules = checkoutSubmodulesIndex > -1;
if (checkoutSubmodulesIndex > -1) args.splice(checkoutSubmodulesIndex, 1);

const command = args[0];
const arg1 = args[1];
const arg2 = args[2];

// ─── Output helpers ───────────────────────────────────────────────────────────

function output(data) {
  if (jsonOutput) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    if (data.success) {
      console.log(`\n✅ ${data.message}`);
      if (data.worktreePath) {
        console.log(`\n📋 Next Steps:`);
        console.log(`   1. cd ${data.worktreePath}`);
        console.log(`   2. Start working on your feature`);
        console.log(`\n🧹 Cleanup when done:`);
        console.log(`   git worktree remove ${data.worktreePath}`);
        console.log(`   git branch -d ${data.branch}`);
      }
      if (data.envTemplatesCopied && data.envTemplatesCopied.length > 0) {
        console.log(`\n📄 Environment templates copied:`);
        data.envTemplatesCopied.forEach(t => console.log(`   ✓ ${t.from} → ${t.to}`));
      } else if (data.envFilesCopied && data.envFilesCopied.length > 0) {
        console.log(`\n📄 Environment files copied:`);
        data.envFilesCopied.forEach(f => console.log(`   ✓ ${f}`));
      }
      if (data.warnings && data.warnings.length > 0) {
        console.log(`\n⚠️  Warnings:`);
        data.warnings.forEach(w => console.log(`   ${w}`));
      }
    } else if (data.info) {
      console.log(`\n📦 Repository Info:`);
      console.log(`   Type: ${data.repoType}`);
      console.log(`   Base branch: ${data.baseBranch}`);
      if (data.worktreeRoot) {
        console.log(`\n📂 Worktree location:`);
        console.log(`   Path: ${data.worktreeRoot}`);
        console.log(`   Source: ${data.worktreeRootSource}`);
      }
      if (data.projects && data.projects.length > 0) {
        console.log(`\n📁 Available projects:`);
        data.projects.forEach(p => console.log(`   - ${p.name} (${p.path})`));
      }
      if (data.envFiles && data.envFiles.length > 0) {
        console.log(`\n🔐 Environment files found:`);
        data.envFiles.forEach(f => console.log(`   - ${f}`));
      }
      if (data.dirtyState) console.log(`\n⚠️  Working directory has uncommitted changes`);
    }
  }
}

function outputError(code, message, details = {}) {
  const errorData = { success: false, error: { code, message, ...details } };
  if (jsonOutput) {
    console.log(JSON.stringify(errorData, null, 2));
  } else {
    console.error(`\n❌ Error [${code}]: ${message}`);
    if (details.suggestion) console.error(`   💡 ${details.suggestion}`);
    if (details.availableProjects) {
      console.error(`\n   Available projects:`);
      details.availableProjects.forEach(p => console.error(`     - ${p}`));
    }
  }
  process.exit(1);
}

// ─── Commands ─────────────────────────────────────────────────────────────────

function cmdInfo() {
  const gitRoot = checkGitRepo(outputError);
  checkGitVersion(outputError);

  const projects = parseGitModules(gitRoot);
  const isMonorepo = projects.length > 0;
  const baseBranch = detectBaseBranch(gitRoot);
  const dirtyState = checkDirtyState();
  const dirtyDetails = dirtyState ? getDirtyStateDetails() : null;
  const envFiles = findEnvFiles(gitRoot);
  const worktreeRoot = getWorktreeRoot(gitRoot, isMonorepo, null, null, outputError);

  const projectEnvFiles = {};
  if (isMonorepo) {
    projects.forEach(p => {
      const projectDir = path.join(gitRoot, p.path);
      if (fs.existsSync(projectDir)) {
        const files = findEnvFiles(projectDir);
        if (files.length > 0) projectEnvFiles[p.name] = files;
      }
    });
  }

  output({
    info: true,
    repoType: isMonorepo ? 'monorepo' : 'standalone',
    gitRoot, baseBranch,
    worktreeRoot: worktreeRoot.dir,
    worktreeRootSource: worktreeRoot.source,
    projects: isMonorepo ? projects : [],
    envFiles,
    projectEnvFiles: isMonorepo ? projectEnvFiles : {},
    dirtyState, dirtyDetails
  });
}

function cmdList() {
  const gitRoot = checkGitRepo(outputError);
  const worktrees = getWorktreeRecords(gitRoot, gitRoot, outputError);

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, worktrees }, null, 2));
  } else {
    console.log('\n📂 Existing worktrees:');
    worktrees.forEach(w => {
      console.log(`   ${w.path}`);
      console.log(`      Branch: ${w.branch} (${(w.commit || '').slice(0, 7)})`);
    });
  }
}

function cmdStatus() {
  const gitRoot = checkGitRepo(outputError);
  checkGitVersion(outputError);

  const worktrees = getWorktreeRecords(gitRoot, gitRoot, outputError).map(worktree => {
    const existsOnDisk = fs.existsSync(worktree.path);
    const isCurrentWorktree = path.resolve(worktree.path) === path.resolve(gitRoot);
    const branchIsTracked = worktree.branch !== 'detached' && worktree.branch !== 'bare';
    const branchExistsLocally = existsOnDisk && branchIsTracked
      ? branchExists(worktree.branch, worktree.path) === 'local'
      : false;
    const baseBranch = existsOnDisk && !worktree.bare ? detectBaseBranch(worktree.path) : null;
    const dirtyState = existsOnDisk && !worktree.bare ? checkDirtyState(worktree.path) : false;
    const dirtyDetails = dirtyState ? getDirtyStateDetails(worktree.path) : null;
    const divergence = existsOnDisk && branchExistsLocally && baseBranch
      ? getAheadBehind(worktree.branch, baseBranch, worktree.path)
      : { ahead: 0, behind: 0 };

    return {
      ...worktree,
      isCurrentWorktree,
      branchExists: branchExistsLocally,
      baseBranch, dirtyState, dirtyDetails,
      ahead: divergence.ahead, behind: divergence.behind
    };
  });

  const currentWorktree = worktrees.find(w => w.isCurrentWorktree) || null;

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, currentWorktree, worktrees }, null, 2));
    return;
  }

  console.log('\n🩺 Worktree Status');
  if (currentWorktree) {
    console.log(`   Current: ${currentWorktree.path}`);
    console.log(`   Branch: ${currentWorktree.branch}`);
    console.log(`   Base: ${currentWorktree.baseBranch || 'n/a'}`);
    console.log(`   Dirty: ${currentWorktree.dirtyState ? 'yes' : 'no'}`);
    console.log(`   Ahead/Behind: ${currentWorktree.ahead}/${currentWorktree.behind}`);
  }
  console.log('\n📂 Known worktrees:');
  worktrees.forEach(worktree => {
    const flags = [];
    if (worktree.isMainWorktree) flags.push('main');
    if (worktree.isCurrentWorktree) flags.push('current');
    if (worktree.dirtyState) flags.push('dirty');
    if (!worktree.branchExists && worktree.branch !== 'detached' && worktree.branch !== 'bare') flags.push('missing-branch');
    if (worktree.prunable) flags.push('prunable');
    const suffix = flags.length > 0 ? ` [${flags.join(', ')}]` : '';
    console.log(`   ${worktree.path}${suffix}`);
    console.log(`      Branch: ${worktree.branch}`);
    console.log(`      Base: ${worktree.baseBranch || 'n/a'} | Ahead/Behind: ${worktree.ahead}/${worktree.behind}`);
  });
}

function cmdCreate() {
  const gitRoot = checkGitRepo(outputError);
  checkGitVersion(outputError);

  const warnings = [];
  if (branchPrefixWarning) warnings.push(branchPrefixWarning);

  // ── Orchestrated mode (parallel agent isolation) ──────────────────────────
  if (orchestrated) {
    const agentName = arg1;
    if (!agentName) {
      outputError('MISSING_AGENT_NAME', 'Agent name is required for --orchestrated mode', {
        suggestion: 'Usage: node worktree.cjs create <agent-name> --orchestrated [--dry-run]'
      });
    }

    const sanitizedAgent = sanitizeFeatureName(agentName, false);
    if (!sanitizedAgent) {
      outputError('INVALID_AGENT_NAME', 'Agent name became empty after sanitization', {
        suggestion: 'Use letters/numbers in agent name (example: "backend-agent")'
      });
    }

    const timestamp = Date.now();
    const branchName = `parallel/${sanitizedAgent}-${timestamp}`;
    const worktreePath = path.join(gitRoot, '.worktrees', sanitizedAgent);
    const baseBranch = explicitBase || detectBaseBranch(gitRoot);

    if (isBranchCheckedOut(branchName, gitRoot)) {
      outputError('BRANCH_CHECKED_OUT', `Branch "${branchName}" is already checked out`, {
        suggestion: 'Use a different agent name or remove the existing worktree'
      });
    }

    if (dryRun) {
      output({
        success: true, dryRun: true,
        message: 'Dry run - no changes made',
        wouldCreate: {
          worktreePath, branch: branchName, agentName: sanitizedAgent,
          baseBranch, orchestrated: true
        },
        warnings: warnings.length > 0 ? warnings : undefined
      });
      return;
    }

    // Ensure .worktrees/ exists (per parallel-execution-rules Rule 3)
    const worktreesDir = path.join(gitRoot, '.worktrees');
    try {
      fs.mkdirSync(worktreesDir, { recursive: true });
    } catch (err) {
      outputError('MKDIR_FAILED', `Failed to create .worktrees/ directory`, { suggestion: 'Check write permissions' });
    }

    const createResult = git(`worktree add -b ${branchName} "${worktreePath}" ${baseBranch}`, { cwd: gitRoot });
    if (!createResult.success) {
      outputError('WORKTREE_CREATE_FAILED', 'Failed to create parallel worktree', {
        suggestion: createResult.stderr || createResult.error,
        gitError: createResult.stderr
      });
    }

    const envResult = copyEnvTemplates(gitRoot, worktreePath);
    envResult.warnings.forEach(w => warnings.push(w));

    output({
      success: true,
      message: 'Parallel agent worktree created',
      worktreePath, branch: branchName,
      agentName: sanitizedAgent, baseBranch,
      orchestrated: true,
      envTemplatesCopied: envResult.copied.length > 0 ? envResult.copied : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    });
    return;
  }

  // ── Standard feature worktree ─────────────────────────────────────────────

  const projects = parseGitModules(gitRoot);
  const isMonorepo = projects.length > 0;

  const safeEnvFilesToCopy = [];
  envFilesToCopy.forEach(envFile => {
    if (!isSafeEnvFileName(envFile)) {
      warnings.push(`Skipped unsafe env file entry: ${envFile}`);
      return;
    }
    if (!safeEnvFilesToCopy.includes(envFile)) safeEnvFilesToCopy.push(envFile);
  });

  let project, feature;
  if (isMonorepo) {
    project = arg1; feature = arg2;
    if (!project || !feature) {
      outputError('MISSING_ARGS', 'Both project and feature are required for monorepo', {
        suggestion: 'Usage: node worktree.cjs create <project> <feature> --prefix <type>',
        availableProjects: projects.map(p => p.name)
      });
    }
  } else {
    feature = arg1;
    if (!feature) {
      outputError('MISSING_FEATURE', 'Feature name is required', {
        suggestion: 'Usage: node worktree.cjs create <feature> --prefix <type>'
      });
    }
  }

  if (checkDirtyState()) {
    const details = getDirtyStateDetails();
    warnings.push(`Uncommitted changes: ${details.modified} modified, ${details.staged} staged, ${details.untracked} untracked`);
  }

  let workDir = gitRoot;
  let projectPath = '';
  let projectName = '';

  if (isMonorepo) {
    const matches = findMatchingProjects(projects, project);
    if (matches.length === 0) {
      outputError('PROJECT_NOT_FOUND', `Project "${project}" not found`, {
        suggestion: 'Check available projects with: node worktree.cjs info',
        availableProjects: projects.map(p => p.name)
      });
    }
    if (matches.length > 1) {
      outputError('MULTIPLE_PROJECTS_MATCH', `Multiple projects match "${project}"`, {
        suggestion: 'Use stop and ask the user in chat to let user select one',
        matchingProjects: matches.map(p => ({ name: p.name, path: p.path }))
      });
    }
    projectPath = matches[0].path;
    projectName = matches[0].name;
    workDir = path.join(gitRoot, projectPath);
    if (!fs.existsSync(workDir)) {
      outputError('PROJECT_DIR_NOT_FOUND', `Project directory not found: ${workDir}`, {
        suggestion: 'Initialize submodules: git submodule update --init'
      });
    }
  }

  const sanitizedFeature = sanitizeFeatureName(feature, noPrefix);
  if (!sanitizedFeature) {
    outputError('INVALID_FEATURE_NAME', 'Feature name became empty after sanitization', {
      suggestion: 'Use letters/numbers in feature name (example: "login-validation")'
    });
  }
  const expectedFeature = noPrefix ? feature.replace(/\s+/g, '-') : feature.toLowerCase().replace(/\s+/g, '-');
  if (sanitizedFeature !== expectedFeature) warnings.push(`Feature name sanitized: "${feature}" → "${sanitizedFeature}"`);

  const branchName = noPrefix ? sanitizedFeature : `${branchPrefix}/${sanitizedFeature}`;

  if (explicitBaseError) {
    const errorMessages = {
      LOOKS_LIKE_FLAG: `Base branch "${explicitBaseError.value}" looks like a flag`,
      SHELL_CHARS: `Base branch "${explicitBaseError.value}" contains invalid shell characters`,
      INVALID_CHARS: `Base branch "${explicitBaseError.value}" contains invalid characters`
    };
    outputError('INVALID_BASE_BRANCH', errorMessages[explicitBaseError.error] || 'Invalid base branch', {
      suggestion: 'Provide a valid branch name (e.g., main, dev, feature/branch-name)'
    });
  }

  const baseBranch = explicitBase || detectBaseBranch(workDir);
  const baseBranchSource = explicitBase ? 'explicit' : 'auto-detected';

  if (explicitBase) {
    const baseExists = branchExists(explicitBase, workDir);
    if (!baseExists) {
      outputError('BASE_BRANCH_NOT_FOUND', `Base branch "${explicitBase}" does not exist`, {
        suggestion: 'Check branch name or use auto-detection by omitting --base',
        availableBranches: ['dev', 'develop', 'main', 'master'].filter(b => branchExists(b, workDir))
      });
    }
  }

  if (isBranchCheckedOut(branchName, workDir)) {
    outputError('BRANCH_CHECKED_OUT', `Branch "${branchName}" is already checked out in another worktree`, {
      suggestion: 'Use a different feature name or remove the existing worktree'
    });
  }

  const worktreeRoot = getWorktreeRoot(gitRoot, isMonorepo, explicitWorktreeRoot, null, outputError);
  const worktreesDir = worktreeRoot.dir;
  const repoName = path.basename(gitRoot);
  const flatFeature = flattenForDirectoryName(sanitizedFeature);
  const worktreeName = isMonorepo ? `${projectName}-${flatFeature}` : `${repoName}-${flatFeature}`;
  const worktreePath = path.join(worktreesDir, worktreeName);

  if (fs.existsSync(worktreePath)) {
    outputError('WORKTREE_EXISTS', `Worktree already exists: ${worktreePath}`, {
      suggestion: `To use: cd ${worktreePath}\nTo remove: git worktree remove ${worktreePath}`
    });
  }

  const branchStatus = branchExists(branchName, workDir);

  if (dryRun) {
    output({
      success: true, dryRun: true,
      message: 'Dry run - no changes made',
      wouldCreate: {
        worktreePath, worktreeRootSource: worktreeRoot.source,
        branch: branchName, baseBranch, baseBranchSource, checkoutSubmodules,
        branchExists: !!branchStatus,
        project: isMonorepo ? projectName : null,
        envFilesToCopy: safeEnvFilesToCopy.length > 0 ? safeEnvFilesToCopy : undefined
      },
      warnings: warnings.length > 0 ? warnings : undefined
    });
    return;
  }

  try {
    fs.mkdirSync(worktreesDir, { recursive: true });
  } catch (err) {
    outputError('MKDIR_FAILED', `Failed to create worktrees directory: ${worktreesDir}`, {
      suggestion: 'Check write permissions'
    });
  }

  if (branchStatus === 'remote') {
    const fetchResult = git(`fetch origin ${branchName}`, { silent: true, cwd: workDir });
    if (!fetchResult.success) {
      outputError('FETCH_FAILED', `Failed to fetch branch from remote: ${branchName}`, {
        suggestion: 'Check network connection and remote repository access'
      });
    }
  }

  const createResult = branchStatus
    ? git(`worktree add "${worktreePath}" ${branchName}`, { cwd: workDir })
    : git(`worktree add -b ${branchName} "${worktreePath}" ${baseBranch}`, { cwd: workDir });

  if (!createResult.success) {
    outputError('WORKTREE_CREATE_FAILED', 'Failed to create worktree', {
      suggestion: createResult.stderr || createResult.error,
      gitError: createResult.stderr
    });
  }

  const sourceDir = isMonorepo ? workDir : gitRoot;
  const envResult = copyEnvTemplates(sourceDir, worktreePath);
  envResult.warnings.forEach(w => warnings.push(w));

  const envFilesCopied = envResult.copied.map(c => c.to);
  if (safeEnvFilesToCopy.length > 0) {
    safeEnvFilesToCopy.forEach(envFile => {
      const sourcePath = path.join(sourceDir, envFile);
      const destPath = path.join(worktreePath, envFile);
      if (fs.existsSync(sourcePath)) {
        try {
          fs.copyFileSync(sourcePath, destPath);
          if (!envFilesCopied.includes(envFile)) envFilesCopied.push(envFile);
        } catch (err) {
          warnings.push(`Failed to copy ${envFile}: ${err.message}`);
        }
      } else {
        warnings.push(`Env file not found: ${envFile}`);
      }
    });
  }

  if (checkoutSubmodules) {
    const submoduleResult = git('submodule update --init --checkout --recursive', { silent: true, cwd: worktreePath });
    if (!submoduleResult.success) {
      outputError('SUBMODULE_CHECKOUT_FAILED', 'Worktree created but submodule checkout failed', {
        suggestion: submoduleResult.stderr || 'Run git submodule update manually in the new worktree',
        worktreePath
      });
    }
  }

  output({
    success: true,
    message: 'Worktree created successfully!',
    worktreePath, worktreeRootSource: worktreeRoot.source,
    branch: branchName, baseBranch, baseBranchSource,
    checkoutSubmodules,
    project: isMonorepo ? projectName : null,
    envFilesCopied, envTemplatesCopied: envResult.copied,
    warnings: warnings.length > 0 ? warnings : undefined
  });
}

function cmdRemove() {
  if (!arg1) {
    outputError('MISSING_WORKTREE', 'Worktree name or path is required', {
      suggestion: 'Usage: node worktree.cjs remove <name-or-path>\nUse "node worktree.cjs list" to see available worktrees'
    });
  }

  const gitRoot = checkGitRepo(outputError);
  checkGitVersion(outputError);
  const worktrees = getWorktreeRecords(gitRoot, gitRoot, outputError);

  const searchTerm = arg1.toLowerCase();
  const removable = worktrees.filter(w => !w.isMainWorktree);

  const exactMatches = removable.filter(w => {
    const name = path.basename(w.path).toLowerCase();
    return name === searchTerm || w.path.toLowerCase() === searchTerm ||
      (w.adminPath || '').toLowerCase() === searchTerm ||
      (w.branch || '').toLowerCase() === searchTerm;
  });
  const prefixMatches = removable.filter(w => {
    const name = path.basename(w.path).toLowerCase();
    return name.startsWith(searchTerm) || w.path.toLowerCase().startsWith(searchTerm) ||
      (w.adminPath || '').toLowerCase().startsWith(searchTerm) ||
      (w.branch || '').toLowerCase().startsWith(searchTerm);
  });
  const containsMatches = removable.filter(w => {
    const name = path.basename(w.path).toLowerCase();
    return name.includes(searchTerm) || w.path.toLowerCase().includes(searchTerm) ||
      (w.adminPath || '').toLowerCase().includes(searchTerm) ||
      (w.branch || '').toLowerCase().includes(searchTerm);
  });

  let removableMatches = exactMatches;
  if (removableMatches.length === 0) removableMatches = prefixMatches;
  if (removableMatches.length === 0 && searchTerm.length >= 4) removableMatches = containsMatches;

  if (removableMatches.length === 0) {
    outputError('WORKTREE_NOT_FOUND', `No worktree matching "${arg1}" found`, {
      suggestion: 'Use "node worktree.cjs list" to see available worktrees',
      availableWorktrees: removable.map(w => path.basename(w.path))
    });
  }

  if (removableMatches.length > 1) {
    outputError('MULTIPLE_WORKTREES_MATCH', `Multiple worktrees match "${arg1}"`, {
      suggestion: 'Be more specific or use full path',
      matchingWorktrees: removableMatches.map(w => ({ name: path.basename(w.path), path: w.path, branch: w.branch }))
    });
  }

  const worktree = removableMatches[0];
  const worktreePath = worktree.path;
  const branchName = worktree.branch;

  if (dryRun) {
    output({
      success: true, dryRun: true,
      message: 'Dry run - no changes made',
      wouldRemove: { worktreePath, branch: branchName, deleteBranch: !!branchName }
    });
    return;
  }

  const removeResult = git(`worktree remove "${worktreePath}" --force`, { silent: true });
  if (!removeResult.success) {
    outputError('WORKTREE_REMOVE_FAILED', `Failed to remove worktree: ${worktreePath}`, {
      suggestion: removeResult.stderr || 'Check if the worktree has uncommitted changes',
      gitError: removeResult.stderr
    });
  }

  let branchDeleted = false;
  let branchDeleteWarning = null;
  if (branchName) {
    const deleteResult = git(`branch -d "${branchName}"`, { silent: true });
    if (deleteResult.success) {
      branchDeleted = true;
    } else {
      branchDeleteWarning = `Branch kept: ${branchName} (${deleteResult.stderr || 'not fully merged'})`;
    }
  }

  output({
    success: true,
    message: 'Worktree removed successfully!',
    removedPath: worktreePath,
    branchDeleted: branchDeleted ? branchName : null,
    branchKept: !branchDeleted && branchName ? branchName : null,
    warnings: branchDeleteWarning ? [branchDeleteWarning] : undefined
  });
}

function cmdPrune() {
  checkGitRepo(outputError);
  checkGitVersion(outputError);

  const pruneArgs = ['worktree', 'prune'];
  if (dryRun) pruneArgs.push('--dry-run');
  pruneArgs.push('--verbose');

  const pruneResult = git(pruneArgs.join(' '), { silent: true });
  if (!pruneResult.success) {
    outputError('WORKTREE_PRUNE_FAILED', 'Failed to prune worktree metadata', {
      suggestion: pruneResult.stderr || pruneResult.error
    });
  }

  const entries = pruneResult.output.split('\n').filter(Boolean);
  if (jsonOutput) {
    console.log(JSON.stringify({
      success: true, dryRun,
      message: dryRun ? 'Prune dry run completed' : 'Worktree prune completed',
      entries
    }, null, 2));
    return;
  }

  console.log(`\n🧹 Worktree Prune${dryRun ? ' (dry run)' : ''}`);
  if (entries.length === 0) {
    console.log('   No stale worktree metadata found.');
    return;
  }
  entries.forEach(entry => console.log(`   ${entry}`));
}

function showHelp() {
  console.log(`Git Worktree Manager for the toolkit

Usage: node worktree.cjs <command> [options]

Commands:
  create <feature>           Create a new feature worktree
  create <agent> --orchestrated  Create a parallel agent worktree in .worktrees/{agent}
  remove <name-or-path>      Remove a worktree and its branch
  info                       Get repo info (type, projects, env files)
  list                       List existing worktrees
  status                     Inspect worktree health and branch status
  prune                      Remove stale worktree metadata

Options:
  --prefix <type>        Branch prefix (feat|fix|refactor|docs|test|chore|perf)
  --base <branch>        Override auto-detected base branch
  --orchestrated         Create a parallel agent worktree in .worktrees/{name} on parallel/{name}-{ts} branch
  --checkout-submodules  Initialize submodules in the new worktree
  --worktree-root <path> Explicit worktree directory
  --json                 Output in JSON format for LLM consumption
  --env <files>          Comma-separated list of .env files to copy (legacy)
  --dry-run              Show what would be done without executing
  --no-prefix            Skip branch prefix and preserve original case
  --help, -h             Show this help message`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  if (command === '--help' || command === '-h' || command === 'help') {
    showHelp();
    return;
  }

  switch (command) {
    case 'create': cmdCreate(); break;
    case 'remove': cmdRemove(); break;
    case 'info':   cmdInfo();   break;
    case 'list':   cmdList();   break;
    case 'status': cmdStatus(); break;
    case 'prune':  cmdPrune();  break;
    case 'review-pr': {
      if (explicitBaseError) outputError('INVALID_BASE_BRANCH', explicitBaseError.message || 'Invalid --base branch');
      reviewPr.cmdReviewPr({ args, dryRun, explicitBase, output, outputError });
      break;
    }
    case 'review-pr-cleanup':
      reviewPr.cmdReviewPrCleanup({ args, dryRun, output, outputError });
      break;
    default:
      outputError('UNKNOWN_COMMAND', `Unknown command: ${command || '(none)'}`, {
        suggestion: 'Available commands: create, remove, info, list, status, prune, review-pr, review-pr-cleanup. Use --help for usage.'
      });
  }
}

main();
