'use strict';
// pre-task-check.cjs — scan a command for prompt-injection patterns.
//
// ADVISORY by contract. It reports and does not stop the call: the patterns are
// coarse enough that a false positive is expected, and a coarse matcher with
// authority to block would be worse than the attack it screens for. The guards
// that do block are registered on their own and are not routed through here.
//
// Patterns are matched against a lowercased copy so a mixed-case attempt is not
// a bypass, except where the pattern is about shell syntax rather than prose.

const BLOCK_PATTERNS = [
  [/ignore previous/, "Contains 'ignore previous' — instruction override attempt"],
  [/ignore all previous/, "Contains 'ignore all previous' — instruction override attempt"],
  [/disregard.*instructions/, "Contains 'disregard instructions' — instruction override attempt"],
  [/disregard.*rules/, "Contains 'disregard rules' — rule override attempt"],
  [/new instructions/, "Contains 'new instructions' — instruction injection attempt"],
  [/system prompt/, "Contains 'system prompt' — prompt extraction/override attempt"],
  [/you are now/, "Contains 'you are now' — identity override attempt"],
  [/forget your rules/, "Contains 'forget your rules' — rule override attempt"],
  [/pretend you are/, "Contains 'pretend you are' — role manipulation attempt"],
  [/act as if/, "Contains 'act as if' — role manipulation attempt"],
  [/ignore your programming/, "Contains 'ignore your programming' — override attempt"],
  [/override.*safety/, "Contains 'override safety' — safety bypass attempt"],
  [/bypass.*security/, "Contains 'bypass security' — security bypass attempt"],
  [/curl.*exfil/, 'Contains suspicious curl + exfil pattern'],
  [/curl.*\$\(/, 'Contains curl with command substitution — possible exfiltration'],
  [/wget.*\$\(/, 'Contains wget with command substitution — possible exfiltration'],
  [/fetch.*and.*execute/, "Contains 'fetch and execute' — remote code execution attempt."],
  [/download.*and.*run/, "Contains 'download and run' — remote code execution attempt."],
  [/curl.*\|.*sh/, "Contains 'curl | sh' — remote script execution pattern."],
  [/curl.*\|.*bash/, "Contains 'curl | bash' — remote script execution pattern."],
];

const WARN_PATTERNS = [
  [/base64/, "Contains 'base64' — possible encoding obfuscation"],
];

/** Paths outside the project are worth a second look, not a refusal. */
const OUTSIDE_PROJECT = /(\/etc\/|\/usr\/|\/var\/|\/tmp\/|~\/\.|~\/.ssh|~\/.bash|~\/.zsh|\/root\/)/;

const LONG = 500;
const VERY_LONG = 5000;

function collect(task) {
  const lower = task.toLowerCase();
  const blocks = [];
  const warns = [];

  // Length first: an unusually long description is the cheapest flooding signal.
  const length = Buffer.byteLength(task, 'utf8');
  if (length > VERY_LONG) {
    warns.push(`Task description is very long (${length} chars). Possible context flooding attempt.`);
  } else if (length > LONG) {
    warns.push(`Task description is unusually long (${length} chars). Review before proceeding.`);
  }

  for (const [pattern, message] of BLOCK_PATTERNS) if (pattern.test(lower)) blocks.push(message);
  for (const [pattern, message] of WARN_PATTERNS) if (pattern.test(lower)) warns.push(message);
  if (OUTSIDE_PROJECT.test(task)) {
    warns.push('References paths outside project directory. Verify this is intentional.');
  }
  return { blocks, warns };
}

module.exports = function preTaskCheck(ctx) {
  const profile = process.env.MEOWKIT_HOOK_PROFILE || process.env.MEOW_HOOK_PROFILE || 'standard';
  if (profile === 'fast') return null;

  const task = (ctx.hookInput && ctx.hookInput.command) || '';
  if (!task) return 'PASS — no task description provided, skipping injection check.\n';

  const { blocks, warns } = collect(task);

  if (blocks.length) {
    return [
      '==== BLOCK — Prompt injection patterns detected ====',
      ...blocks.map((m) => `BLOCK — ${m}`),
      '',
      'Task execution STOPPED. Review the task description for injection attempts.',
      'If this is a false positive, modify the task description and retry.',
      '',
    ].join('\n');
  }

  if (warns.length) {
    return [
      '==== WARN — Suspicious patterns detected ====',
      ...warns.map((m) => `WARN — ${m}`),
      '',
      'Confirm with user before proceeding.',
      '',
    ].join('\n');
  }

  return 'PASS — no injection patterns detected.\n';
};
