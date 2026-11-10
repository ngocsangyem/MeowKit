#!/usr/bin/env node
'use strict';
// check-careful.cjs — bundled copy of the kit's skill guard, self-contained.
//
// A provider bundle ships no shared library for these and installs skills one
// at a time, so a require across skill directories would couple trees that
// arrive independently. Generated from the kit guard of the same name; edit
// that one and regenerate.

// check-careful.cjs — ask before running a destructive command.
//
// Answers with a permission decision, not an exit code: the host turns a
// decision into a prompt the user can approve or refuse, which is the point. A
// failing exit is a flat refusal and cannot express "ask", so it would turn a
// confirmable warning into a block.//
// The decision is returned inside `hookSpecificOutput`, which is the form this
// event reads. A top-level `permissionDecision` — the shape the shell guard
// printed — is not a recognised field for it, so that output was read as "no
// decision" and the guard enforced nothing even once it was registered.
//
// In a production context a CRITICAL command is refused outright rather than
// prompted, because that is the one context where "approve to continue" is the
// wrong affordance — the override has to be a deliberate act outside the prompt.
//
// Every warning is logged before the answer is printed, so the record exists
// whether or not the user then approves.

const fs = require('node:fs');
const path = require('node:path');

// destructive-command-patterns.cjs — the table of commands worth a confirmation.
//
// Order is significant: the first match wins, so a narrower rule must come
// before the broader one it is a special case of. Namespace deletion sits ahead
// of generic resource deletion for exactly that reason.
//
// Severity classifies the damage, not the response: CRITICAL means irreversible
// or whole-system, HIGH means expensive to undo. The guard decides what to do
// with that, and only escalates to a refusal in a production context.

/** Build outputs and dependency trees — deleting these is routine, not destructive. */
const DISPOSABLE_TARGETS = [
  'node_modules', '.next', 'dist', '__pycache__', '.cache', 'build',
  '.turbo', 'coverage', '.gradle', 'target', 'vendor', 'Pods', '.venv', 'venv',
];

/** `[pattern, warning, id, severity, lowercase]` — lowercase for prose-like syntax. */
const PATTERNS = [
  [/rm\s+(-[a-zA-Z]*r|--recursive)/, 'Destructive: recursive delete (rm -r). This permanently removes files.', 'rm_recursive', 'CRITICAL', false],
  [/find\s+.*-delete\b/, 'Destructive: find -delete removes matched files. Run with -print first to review.', 'find_delete', 'HIGH', false],
  [/find\s+.*-exec\s+rm\b/, 'Destructive: find -exec rm mass-deletes files. Run with -print first to review.', 'find_exec_rm', 'HIGH', false],
  [/\b(shred|wipe)\s+/, 'Destructive: shred/wipe irreversibly overwrites files.', 'shred_wipe', 'CRITICAL', false],
  [/\bdd\s+.*of=\/dev\/(sd|disk|nvme)/, 'Destructive: dd with disk target overwrites raw disk. Can destroy the machine.', 'dd_disk', 'CRITICAL', false],
  [/chmod\s+(-R\s+|--recursive\s+)(000|777)\b/, 'Destructive: recursive chmod 000/777 corrupts permissions. Apply to specific paths instead.', 'chmod_recursive_dangerous', 'HIGH', false],

  [/drop\s+(table|database|schema)/, 'Destructive: SQL DROP detected. This permanently deletes database objects.', 'sql_drop', 'CRITICAL', true],
  [/\btruncate\b/, 'Destructive: SQL TRUNCATE deletes all rows from a table.', 'sql_truncate', 'CRITICAL', true],
  [/prisma\s+migrate\s+reset\b/, 'Destructive: prisma migrate reset drops and recreates the database.', 'prisma_reset', 'CRITICAL', false],
  [/(rails|rake|bundle\s+exec\s+rake)\s+db:drop\b/, 'Destructive: db:drop wipes the Rails database.', 'rails_db_drop', 'CRITICAL', false],
  [/flyway\s+clean\b/, 'Destructive: flyway clean drops all DB objects managed by Flyway.', 'flyway_clean', 'CRITICAL', false],

  [/redis-cli\s+.*\b(flushall|flushdb)\b/, 'Destructive: Redis FLUSH wipes keys. FLUSHALL hits all DBs; FLUSHDB hits current.', 'redis_flush', 'CRITICAL', true],
  [/(mongo|mongosh).*dropDatabase\(/, 'Destructive: MongoDB dropDatabase removes the entire database.', 'mongo_drop_db', 'CRITICAL', false],

  [/git\s+push\s+.*(-f\b|--force\b)/, 'Destructive: git force-push rewrites remote history. Prefer --force-with-lease.', 'git_force_push', 'CRITICAL', false],
  [/git\s+reset\s+--hard/, 'Destructive: git reset --hard discards all uncommitted changes. Stash first.', 'git_reset_hard', 'HIGH', false],
  [/git\s+(checkout|restore)\s+\./, 'Destructive: discards all uncommitted changes in the working tree. git diff first.', 'git_discard', 'HIGH', false],
  [/git\s+clean\s+(-[a-zA-Z]*f[a-zA-Z]*d|-f\s+-d)/, 'Destructive: git clean -fd/-fdx deletes untracked files. Use -n for dry run first.', 'git_clean_force', 'HIGH', false],
  [/git\s+filter-(branch|repo)\b/, 'Destructive: git filter-branch/filter-repo rewrites entire history. Backup branch first.', 'git_filter', 'CRITICAL', false],

  [/kubectl\s+delete\s+(namespace|ns)\b/, 'Destructive: kubectl delete namespace removes the entire namespace and all its resources.', 'kubectl_delete_ns', 'CRITICAL', false],
  [/kubectl\s+delete\b/, 'Destructive: kubectl delete removes Kubernetes resources. Describe first to understand dependencies.', 'kubectl_delete', 'HIGH', false],
  [/docker\s+(rm\s+.*-f|system\s+prune\s+.*-a)/, 'Destructive: docker force-remove or prune -a. Removes containers/images/volumes.', 'docker_destructive', 'HIGH', false],
  [/helm\s+uninstall\b/, 'Destructive: helm uninstall tears down the release. Run \'helm get all <release>\' first.', 'helm_uninstall', 'HIGH', false],

  [/terraform\s+destroy\b/, 'Destructive: terraform destroy removes all managed infrastructure. Run \'terraform plan -destroy\' first.', 'terraform_destroy', 'CRITICAL', false],
  [/aws\s+s3\s+rm\s+.*(--recursive|-r\b)/, 'Destructive: aws s3 rm --recursive wipes bucket contents. Enable versioning first.', 'aws_s3_rm_recursive', 'CRITICAL', false],
  [/gcloud\s+.*\bdelete\b/, 'Destructive: gcloud delete removes a cloud resource. Check dependencies via console first.', 'gcloud_delete', 'HIGH', false],
];

const RECURSIVE_RM = /rm[ \t]+(-[a-zA-Z]*r[a-zA-Z]*[ \t]+|--recursive[ \t]+)/;

/**
 * True when a recursive delete names only disposable targets. Without this a
 * routine `rm -rf node_modules` would prompt every time, which trains people to
 * approve the prompt without reading it.
 */
function isDisposableCleanup(command) {
  if (!RECURSIVE_RM.test(command)) return false;
  const args = command.replace(/.*rm[ \t]+(-[a-zA-Z]+[ \t]+)*/, '').replace(/--recursive[ \t]*/, '');
  const targets = args.split(/\s+/).filter(Boolean);
  if (targets.length === 0) return false;
  return targets.every((target) => {
    if (target.startsWith('-')) return true;
    const leaf = target.replace(/\/+$/, '').split('/').pop();
    return DISPOSABLE_TARGETS.includes(leaf);
  });
}

/** The first matching rule, or null. */
function classify(command) {
  const lower = command.toLowerCase();
  for (const [pattern, warning, id, severity, useLower] of PATTERNS) {
    if (pattern.test(useLower ? lower : command)) return { warning, id, severity };
  }
  return null;
}

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();

const allow = () => {
  process.stdout.write('{}\n');
  process.exit(0);
};

const answer = (decision, reason) => {
  process.stdout.write(`${JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decision, permissionDecisionReason: reason },
  })}\n`);
  process.exit(0);
};

/** Any of these naming a production-like environment escalates a refusal. */
function inProduction(env) {
  const combined = `${env.NODE_ENV || ''}${env.APP_ENV || ''}${env.ENVIRONMENT || ''}`;
  return /production|prod|staging/.test(combined);
}

/**
 * Append the warning to the override log. The user's actual decision happens at
 * the host's permission prompt, which this process never sees, so the entry
 * records the request rather than the outcome.
 */
function logOverrideRequest({ command, id, severity, now }) {
  const dir = process.env.CLAUDE_PLUGIN_DATA || path.join(root, '.meowkit/telemetry');
  const file = path.join(dir, 'security-log.md');
  try {
    fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, [
        '# Security Override Log',
        '',
        '| Timestamp | Pattern | Severity | Action | Command |',
        '|-----------|---------|----------|--------|---------|',
        '',
      ].join('\n'));
    }
    // One line per entry, so a multi-line command cannot break the table.
    const oneLine = command.replace(/\n/g, ' ').replace(/\|/g, '\\|');
    const ts = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    fs.appendFileSync(file, `| ${ts} | ${id || 'unknown'} | ${severity || 'UNKNOWN'} | override-request | ${oneLine} |\n`);
  } catch {
    // An unwritable log must not turn into a refusal.
  }
}

/**
 * Read the hook payload from stdin. Inlined because a bundle ships no shared
 * reader. The path is returned exactly as the payload spelled it: the guard
 * echoes it back and matches it against repo-relative rules.
 */
function readHookInput() {
  return new Promise((resolve) => {
    let raw = '';
    const empty = { ok: false, filePath: '', command: '' };
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { raw += chunk; });
    process.stdin.on('error', () => resolve(empty));
    process.stdin.on('end', () => {
      if (raw.trim() === '') return resolve(empty);
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        return resolve(empty);
      }
      if (data === null || typeof data !== 'object' || Array.isArray(data)) return resolve(empty);
      const toolInput = (data.tool_input && typeof data.tool_input === 'object') ? data.tool_input : {};
      const str = (v) => (v === null || v === undefined ? '' : String(v));
      return resolve({ ok: true, filePath: str(toolInput.file_path), command: str(toolInput.command) });
    });
  });
}

readHookInput().then((input) => {
  const command = input.command;
  if (!command) allow();

  if (isDisposableCleanup(command)) allow();

  const finding = classify(command);
  if (!finding) allow();

  logOverrideRequest({ command, id: finding.id, severity: finding.severity, now: new Date() });

  if (inProduction(process.env) && finding.severity === 'CRITICAL') {
    answer('block', `[careful] PRODUCTION BLOCK: ${finding.warning} Override requires a human to unset NODE_ENV/APP_ENV/ENVIRONMENT.`);
  }
  answer('ask', `[careful] ${finding.warning}`);
});
