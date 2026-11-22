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

/** The blocking-class findings in `task`, matched against a lowercased copy. */
function collect(task) {
  const lower = task.toLowerCase();
  return BLOCK_PATTERNS.filter(([pattern]) => pattern.test(lower)).map(([, message]) => message);
}

module.exports = function preTaskCheck(ctx) {
  const profile = process.env.MEOWKIT_HOOK_PROFILE || process.env.MEOW_HOOK_PROFILE || 'standard';
  if (profile === 'fast') return null;

  const task = (ctx.hookInput && ctx.hookInput.command) || '';
  if (!task) return 'PASS — no task description provided, skipping injection check.\n';

  const blocks = collect(task);

  // Only a blocking-class match reaches the model, worded as a finding. A long command or a
  // path outside the project matched nearly every Bash call and never an attack, so neither
  // is reported: a note on every call teaches the reader to skip the one that matters.
  if (blocks.length) {
    return {
      context: [
        // The opening words are the phrase `mewkit doctor --hard-gates` matches, older binaries included.
        'Injection scan flagged this Bash command: it matches blocking-class prompt-injection patterns. '
          + 'The scan is advisory; the command was not stopped.',
        ...blocks.map((m) => `- ${m}`),
      ].join('\n'),
    };
  }

  return 'PASS — no injection patterns detected.\n';
};
