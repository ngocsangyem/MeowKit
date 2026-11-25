'use strict';
// privacy-shell-reads.cjs — the files a shell command reads, as far as its words show.
//
// Best effort by design: the command is split into words with quotes removed, and only the
// arguments of a known read, search, list or copy-out command (and an input redirect) are
// candidates. A path built from a variable or a glob, a command inside `bash -c`, `eval` or a
// script file, and a file a directory-wide search happens to reach are not seen. Pure.

/** Shell commands that print or search what they name. */
const READ_VERBS = new Set(['cat', 'tac', 'head', 'tail', 'less', 'more', 'grep', 'egrep', 'fgrep', 'rg', 'ag', 'sed', 'awk', 'gawk', 'bat', 'nl', 'strings', 'xxd', 'od', 'hexdump', 'cut', 'sort', 'uniq', 'diff', 'cmp', 'jq', 'base64', 'base32', 'iconv']);
/** Shell commands that list names; they count for archived plans, not for credential files. */
const LIST_VERBS = new Set(['ls', 'find', 'tree']);
/** Commands that copy, upload, encode, pack or load what they name; judged for credential files. */
const COPY_VERBS = new Set(['cp', 'scp', 'rsync', 'install', 'openssl', 'gpg', 'source', '.', 'curl', 'wget', 'tar', 'zip', '7z', 'dd']);
const SEARCH_VERB = /^(?:e|f)?grep$|^rg$|^ag$/;
const WRAPPERS = new Set(['sudo', 'command', 'env', 'nice', 'time', 'exec', 'nohup']);

/** Options whose next word is a value (a pattern, an exclusion, an output), never a file read. */
const SEARCH_VALUE_OPTIONS = ['-e', '--regexp', '-g', '--glob', '--iglob', '--exclude', '--exclude-dir', '--include', '-A', '-B', '-C', '-m', '--max-count', '-t', '--type', '-T', '--type-not'];
const VALUE_OPTIONS = {
  grep: SEARCH_VALUE_OPTIONS, egrep: SEARCH_VALUE_OPTIONS, fgrep: SEARCH_VALUE_OPTIONS, rg: SEARCH_VALUE_OPTIONS, ag: SEARCH_VALUE_OPTIONS,
  cp: ['-t', '--target-directory'], install: ['-t', '--target-directory', '-m', '-o', '-g'],
  scp: ['-i', '-F', '-P', '-o', '-J', '-c', '-l', '-S'], rsync: ['--exclude', '--include', '--exclude-from', '-e', '--rsh'],
  tar: ['-f', '--file', '--exclude', '-C', '--directory', '-X', '--exclude-from', '-T', '--files-from'],
  zip: ['-x', '--exclude', '-i', '--include'], openssl: ['-out', '-passout'], gpg: ['-o', '--output'], base64: ['-o', '--output'],
};

/** `<<WORD`, `<<-WORD`, `<<'WORD'`, but not the `<<<` here-string. */
const HEREDOC = /(?<!<)<<(?!<)-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/g;
/** A heredoc fed to a shell is commands, not data, so its body is still read. */
const SHELL_FED = /\b(?:bash|sh|zsh|dash|ksh)\b[^|;&]*<</;

/**
 * The command with heredoc bodies removed. A body is text handed to a command's stdin (the
 * file `cat > notes.md <<EOF` writes), so a path written inside it is not a command's argument.
 */
function withoutHeredocBodies(command) {
  const kept = [];
  const pending = [];
  for (const line of command.split('\n')) {
    if (pending.length) {
      const { word, keep } = pending[0];
      if (line.replace(/^\t+/, '') === word) pending.shift();
      else if (keep) kept.push(line);
      continue;
    }
    kept.push(line);
    const keep = SHELL_FED.test(line);
    for (const m of line.matchAll(HEREDOC)) pending.push({ word: m[2], keep });
  }
  return kept.join('\n');
}

/** Quote-aware split of a shell command into segments of words, cut at `|`, `;`, `&`, `(`, `)` and newlines. */
function shellSegments(rawCommand) {
  const command = withoutHeredocBodies(rawCommand);
  const segments = [[]];
  let word = null;
  let quote = '';
  const end = () => { if (word !== null) segments[segments.length - 1].push(word); word = null; };
  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i];
    if (quote) { if (ch === quote) quote = ''; else word = (word || '') + ch; continue; }
    if (ch === '"' || ch === "'") { quote = ch; word = word || ''; continue; }
    if (ch === '\\' && i + 1 < command.length) { word = (word || '') + command[i += 1]; continue; }
    if (/[|;&()\n`]/.test(ch)) { end(); if (segments[segments.length - 1].length) segments.push([]); continue; }
    if (ch === '<' || ch === '>') { end(); segments[segments.length - 1].push(ch); continue; }
    if (/\s/.test(ch)) { end(); continue; }
    word = (word || '') + ch;
  }
  end();
  return segments.filter((s) => s.length);
}

/** The files a copy-out command takes its content from; destinations and option values are left out. */
function copySources(verb, args, positional) {
  if (verb === 'curl' || verb === 'wget' || verb === 'dd') {
    const out = [];
    for (let i = 0; i < args.length; i += 1) {
      const a = args[i];
      const attached = a.match(/^(?:-[A-Za-z]|--[a-z-]+=|[^=@<-][^=@<]*=)?[@<](.+)$/) || a.match(/^(?:--(?:post|body)-file=|if=)(.+)$/);
      if (attached) out.push(attached[1].replace(/;type=.*$/, ''));
      else if (/^(?:-T|--upload-file|--post-file|--body-file)$/.test(a) && args[i + 1]) out.push(args[i += 1]);
    }
    return out;
  }
  if (verb === 'cp' || verb === 'scp' || verb === 'rsync' || verb === 'install') {
    return args.some((a) => /^(?:-t|--target-directory)(?:=|$)/.test(a)) ? positional : positional.slice(0, -1);
  }
  if (verb === 'tar') {
    // Old-style `tar czf out.tgz src`: the first word is the bundled mode when no dash precedes it.
    const mode = args[0] === positional[0] && /^[A-Za-z]+$/.test(positional[0] || '') ? positional[0] : '';
    const creates = /[cru]/.test(mode) || args.some((a) => /^-[A-Za-z]*[cru]|^--(?:create|append|update)$/.test(a));
    if (!creates) return [];
    let rest = mode ? positional.slice(1) : positional;
    // A bundled `czf` or `-czf` takes the archive name, an output, as its next word.
    if (/f/.test(mode) || args.some((a) => /^-[A-Za-z]+f$/.test(a))) rest = rest.slice(1);
    return rest;
  }
  if (verb === 'zip') return positional.slice(1);
  if (verb === '7z') return positional.slice(2);
  return positional;
}

/**
 * The first path a shell command reads for which `isTarget` holds, or null. A read or search
 * command and an input redirect count; listing commands count when `lists` is set, copy-out
 * commands when `copies` is. Output redirect targets, the pattern of a search and option
 * values (`--exclude-dir=archive`, `--exclude .env`) are never reads, and `sed -i` writes.
 */
function pathReadInCommand(command, isTarget, { lists = false, copies = false } = {}) {
  for (const words of shellSegments(String(command || ''))) {
    for (let i = 0; i < words.length - 1; i += 1) if (words[i] === '<' && words[i + 1] !== '<' && isTarget(words[i + 1])) return words[i + 1];
    let at = 0;
    while (at < words.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[at]) || WRAPPERS.has(words[at]))) at += 1;
    const verb = (words[at] || '').replace(/^.*\//, '');
    const counted = READ_VERBS.has(verb) || (lists && LIST_VERBS.has(verb)) || (copies && COPY_VERBS.has(verb));
    if (!counted) continue;
    // An output redirect target is written, not read (`cat > archive/x/notes.md`).
    const args = [];
    for (let i = at + 1; i < words.length; i += 1) {
      if (words[i] === '>') { while (words[i + 1] === '>') i += 1; i += 1; continue; }
      if (words[i] !== '<') args.push(words[i]);
    }
    if (verb === 'sed' && args.some((a) => /^-[a-zA-Z]*i|^--in-place/.test(a))) continue;
    const valueOptions = VALUE_OPTIONS[verb] || [];
    let positional = [];
    for (let i = 0; i < args.length; i += 1) {
      if (valueOptions.includes(args[i])) i += 1;
      else if (!args[i].startsWith('-')) positional.push(args[i]);
    }
    // A search's first positional word is its pattern unless -e/-f gave one.
    if (SEARCH_VERB.test(verb) && !args.some((a) => /^-(?:e|f|-regexp|-file)/.test(a))) positional = positional.slice(1);
    const named = COPY_VERBS.has(verb) ? copySources(verb, args, positional) : positional;
    const hit = named.find(isTarget);
    if (hit) return hit;
  }
  return null;
}

module.exports = { pathReadInCommand, shellSegments };
