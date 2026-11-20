'use strict';
// ship-command.cjs — does a shell command ship code, and how?
//
// A substring match on "git commit" misses `git  commit`, `git -C . commit`, `git -c k=v commit`,
// an alias such as `git ci`, and `gh pr create|merge`. This tokenises the command instead:
// it splits it into simple commands at `;`, `&&`, `||`, `|` and newlines, drops leading
// variable assignments and `env`/`command` wrappers, skips git's global options, resolves a git
// alias through `git config`, and then matches the subcommand.
//
// Not seen, by design (listed in the enforcement matrix): a ship run inside `bash -c`, `eval`,
// a script file, a subshell or command substitution, or by any other tool than git and gh.
//
// Pure apart from the alias lookup, which runs `git config` in the project root.

const { spawnSync } = require('node:child_process');

/** git global options that take their value as the next word. */
const GIT_OPTS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--super-prefix', '--config-env', '--exec-path', '--list-cmds']);
const GIT_SHIP = new Set(['commit', 'push', 'merge']);
const GH_SHIP = new Set(['create', 'merge']);
const MAX_ALIAS_DEPTH = 5;

/** Split a command line into simple commands, each a list of words with quotes removed. */
function simpleCommands(line) {
  const commands = [];
  let words = [];
  let word = '';
  let inWord = false;
  let quote = '';
  const endWord = () => {
    if (inWord) words.push(word);
    word = '';
    inWord = false;
  };
  const endCommand = () => {
    endWord();
    if (words.length) commands.push(words);
    words = [];
  };
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = '';
      else if (ch === '\\' && quote === '"' && i + 1 < line.length) word += line[(i += 1)];
      else word += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      inWord = true;
    } else if (ch === '\\' && i + 1 < line.length) {
      word += line[(i += 1)];
      inWord = true;
    } else if (ch === ';' || ch === '\n' || ch === '|' || ch === '&' || ch === '(' || ch === ')') {
      endCommand();
    } else if (ch === ' ' || ch === '\t') {
      endWord();
    } else {
      word += ch;
      inWord = true;
    }
  }
  endCommand();
  return commands;
}

/** Drop `FOO=bar` assignments and `env` / `command` / `exec` / `sudo` wrappers in front of a command. */
function stripPrefix(words) {
  let i = 0;
  while (i < words.length) {
    const w = words[i];
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w)) i += 1;
    else if (w === 'env' || w === 'command' || w === 'exec' || w === 'sudo' || w === 'nohup' || w === 'time') i += 1;
    else if (i > 0 && words[i - 1] === 'env' && w.startsWith('-')) i += 1;
    else break;
  }
  return words.slice(i);
}

const programName = (word) => word.replace(/^.*\//, '');

function gitAlias(name, root) {
  if (!root) return null;
  const r = spawnSync('git', ['config', '--get', `alias.${name}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : null;
}

/** The ship action of a git invocation (words after `git`), resolving aliases. */
function gitShip(args, root, depth) {
  let i = 0;
  while (i < args.length && args[i].startsWith('-')) {
    const opt = args[i];
    i += GIT_OPTS_WITH_VALUE.has(opt) ? 2 : 1;
  }
  const sub = args[i];
  if (!sub) return null;
  if (GIT_SHIP.has(sub)) return { kind: sub, args: args.slice(i + 1) };
  if (depth >= MAX_ALIAS_DEPTH) return null;
  const alias = gitAlias(sub, root);
  if (!alias) return null;
  // A `!` alias runs a shell command; anything else is git arguments.
  if (alias.startsWith('!')) return parseShipCommand(alias.slice(1), { root, depth: depth + 1 });
  return gitShip([...simpleCommands(alias)[0] || [], ...args.slice(i + 1)], root, depth + 1);
}

/** `gh pr create` / `gh pr merge`, with gh's own flags allowed in between. */
function ghShip(args) {
  const words = args.filter((w) => !w.startsWith('-'));
  const pr = words.indexOf('pr');
  if (pr === -1) return null;
  const action = words[pr + 1];
  return GH_SHIP.has(action) ? { kind: `pr-${action}`, args: args.slice(args.indexOf(action) + 1) } : null;
}

/**
 * `{ kind, args }` for the first ship action in `command`, or null. `kind` is `commit`, `push`,
 * `merge`, `pr-create` or `pr-merge`; `args` are the words after the subcommand.
 * @param {string} command
 * @param {{ root?: string, depth?: number }} [opts]
 */
function parseShipCommand(command, { root = '', depth = 0 } = {}) {
  if (typeof command !== 'string' || !command.trim()) return null;
  for (const raw of simpleCommands(command)) {
    const words = stripPrefix(raw);
    if (!words.length) continue;
    const program = programName(words[0]);
    const found = program === 'git' ? gitShip(words.slice(1), root, depth) : program === 'gh' ? ghShip(words.slice(1)) : null;
    if (found) return found;
  }
  return null;
}

module.exports = { parseShipCommand, simpleCommands };
