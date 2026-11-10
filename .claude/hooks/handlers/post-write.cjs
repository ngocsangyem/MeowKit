'use strict';
// post-write.cjs — security scan of a file that has already been written.
//
// This runs AFTER the write, so it DETECTS a bad pattern; it cannot prevent one,
// because the bytes are already on disk. A finding's BLOCK severity classifies
// the pattern, not the outcome: the tool result is failed so the finding goes
// back to the model to fix, but the file was written. Preventing a write is the
// pre-write guards' job, and quarantining a bad one is nobody's job yet — this
// reports honestly instead of pretending otherwise.
//
// Findings go to stderr. On this event stderr is the channel the host forwards
// to the model; a non-blocking exit would surface as a hook error notice
// instead, which the model does not see.

const fs = require('node:fs');
const path = require('node:path');

/** Patterns per file type, with the severity that classifies each one. */
const CHECKS = {
  ts: [
    ['BLOCK', 'Hardcoded secret detected', /api_key=|apiKey=|secret=|password=|token=/],
    ['BLOCK', "Usage of 'any' type", /: any|as any/],
    ['WARN', 'process.env without validation', /process\.env\./],
    ['BLOCK', 'Potential SQL injection via template literal', /`[^`]*(SELECT|INSERT|UPDATE|DELETE)/],
    ['BLOCK', 'JWT secret in source code', /jwt.*secret.*=.*["']/],
  ],
  vue: [
    ['BLOCK', 'v-html with dynamic content (XSS risk)', /v-html/],
    ['BLOCK', 'localStorage used for tokens/auth', /localStorage.*token|localStorage.*auth/],
  ],
  swift: [
    ['BLOCK', 'UserDefaults used for sensitive data', /UserDefaults.*password|UserDefaults.*token|UserDefaults.*secret/],
    ['BLOCK', 'Disabled certificate validation', /allowsInvalidSSLCertificate|disableCertificatePinning/],
  ],
  sql: [
    ['BLOCK', 'RLS disabled', /ENABLE ROW LEVEL SECURITY.*false|NO FORCE ROW LEVEL SECURITY/],
    ['WARN', 'CASCADE DELETE detected — review carefully', /CASCADE/],
  ],
  sh: [
    ['BLOCK', 'Destructive rm -rf with root or wildcard', /rm -rf \/|rm -rf \*|rm -rf ~/],
    ['BLOCK', 'DROP TABLE/DATABASE without confirmation', /DROP TABLE|DROP DATABASE/],
    ['BLOCK', 'Force push to remote', /git push.*--force|git push.*-f /],
    ['BLOCK', 'Hard reset (destroys uncommitted work)', /git reset --hard/],
    ['WARN', 'kubectl delete detected — review scope', /kubectl delete/],
    ['WARN', 'docker rm/rmi detected — review scope', /docker rm|docker rmi/],
    ['WARN', 'chmod 777 (world-writable)', /chmod 777/],
    ['WARN', 'Pipe to sh/bash from network', /curl.*\|.*sh|curl.*\|.*bash|wget.*\|.*sh/],
  ],
};

/** Extensions that share a rule set. */
const ALIASES = { js: 'ts', bash: 'sh' };

function findingsFor(content, checks, fileName) {
  const lines = content.split('\n');
  const out = [];
  let hasBlock = false;
  for (const [severity, description, pattern] of checks) {
    lines.forEach((line, i) => {
      if (!pattern.test(line)) return;
      out.push(`${severity} — ${description} at line ${i + 1} in ${fileName}`);
      if (severity === 'BLOCK') hasBlock = true;
    });
  }
  return { out, hasBlock };
}

module.exports = function postWrite(ctx) {
  // The path as the payload spelled it: the finding quotes it back.
  const file = (ctx.hookInput && ctx.hookInput.filePath) || '';
  if (!file) return null;

  const abs = path.isAbsolute(file) ? file : path.join(ctx.root, file);
  let content;
  try {
    if (!fs.statSync(abs).isFile()) return null;
    content = fs.readFileSync(abs, 'utf8');
  } catch {
    // The file may already be gone; a scan of nothing finds nothing.
    return null;
  }

  const fileName = path.basename(file);
  const rawExt = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.') + 1) : fileName;
  const ext = ALIASES[rawExt] || rawExt;
  const checks = CHECKS[ext];
  if (!checks) return { stdout: `PASS — no security checks for .${rawExt} files [${fileName}]\n`, feedback: false };

  const { out, hasBlock } = findingsFor(content, checks, fileName);
  if (out.length === 0) return { stdout: `PASS — no issues found in ${fileName}\n`, feedback: false };

  // Marked as feedback so the dispatcher emits it after every other observer
  // has had its turn, and so a BLOCK reaches the model rather than being
  // swallowed with the rest of the advisory output.
  return { stderr: `${out.join('\n')}\n`, exitCode: hasBlock ? 2 : 0, feedback: true };
};
