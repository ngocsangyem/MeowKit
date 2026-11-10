#!/usr/bin/env node
'use strict';
// config-get.cjs — print one resolved config value, for a caller that is not JS.
//
// The shell scripts under `.claude/skills/` used to take their thresholds from
// the environment. The committed config file is the single source for them now,
// and a POSIX shell cannot parse YAML, so it asks this instead of reading a
// variable that nothing sets any more. One value per call, on stdout, so the
// caller stays a one-line command substitution.
//
//   node .claude/hooks/lib/config-get.cjs <dotted.key> [fallback]
//
// Always exits 0 with exactly one line, except on a missing key argument. An
// absent file, an absent key and an invalid config all print the fallback: the
// callers are cost brakes, and one that failed shut because of a typo in a
// comment would be worse than one that kept its documented default. An invalid
// config is reported by `mewkit doctor`, which is where a human can act on it.

const { configValue } = require('./read-config.cjs');

const [key, fallback = ''] = process.argv.slice(2);
if (key === undefined || key === '') {
  process.stderr.write('usage: config-get.cjs <dotted.key> [fallback]\n');
  process.exit(2);
}

let text = fallback;
try {
  const { value } = configValue(key, fallback);
  if (value === true) text = 'true';
  else if (value === false) text = 'false';
  else text = String(value);
} catch {
  text = fallback;
}
process.stdout.write(`${text}\n`);
