'use strict';
// yaml-subset.cjs — parse the deliberately small YAML dialect the project config
// is written in, using nothing but what node ships.
//
// Hooks have zero npm dependencies, and that is load-bearing: a guard that needs
// `node_modules` stops working on a fresh clone, which is the exact session where
// it matters most. So the config grammar is small enough to parse by hand:
//   two nesting levels, scalars only (boolean, integer, string), `#` comments.
//   no anchors, no aliases, no block scalars, no sequences, no tabs.
// Anything outside it is an error carrying the line number, never a partial
// parse — a config that half-applied would be worse than one that was rejected.
//
// Output is FLAT: `a.b` rather than nested objects. The CLI reader parses the
// same text with js-yaml and flattens the same way, so the two can be compared
// structurally rather than by hoping two shapes look alike.

// The one key allowed to start with `$`: a pointer to the published JSON Schema
// rather than a setting, and a live line so an editor validates as the user types.
const SCHEMA_KEY = '$schema';

const KEY = /^[A-Za-z][A-Za-z0-9_.-]*$/;

const err = (code, line, message) => ({ ok: false, error: { code, line, message } });

// A value's SPELLING is where two readers part company most quietly. A full YAML
// parser resolves `True`, `+5`, `0x1f`, `.inf` and `"LEA\x4E"`; this one would see
// five strings, and the same committed file would then mean different things on
// either side of the kit. Every spelling outside the subset is therefore refused
// by name, and the message says what to write instead.
const DECIMAL_INT = /^-?(0|[1-9]\d*)$/;
const BOOLEAN_MISSPELLED = /^(True|TRUE|False|FALSE)$/;
const INTEGERISH = /^[-+]?(0[xXoObB][0-9A-Fa-f_]+|\d[\d_]*)$/;
const FLOATISH = /^[-+]?(\.\d+|\d+\.\d*|\d+(\.\d*)?[eE][-+]?\d+|\.(inf|Inf|INF|nan|NaN|NAN))$/;
const NULLISH = /^(null|Null|NULL|~)$/;

/** The first out-of-subset spelling in `text`, or `null` when it is inside it. */
function outOfSubsetScalar(text, line) {
  const quote = text[0] === '"' || text[0] === "'" ? text[0] : '';
  if (quote !== '') {
    const body = text.slice(1);
    const close = body.indexOf(quote);
    if (close === -1) {
      return err('unterminated-quote', line, `${text} opens a quote and never closes it; add the closing ${quote}`);
    }
    if (close !== body.length - 1) {
      return err('trailing-content-after-quote', line, `${text} has content after the closing quote; a value is one scalar, and the grammar has no '' escape`);
    }
    if (quote === '"' && body.includes('\\')) {
      return err('escape-not-supported', line, `${text} uses a backslash escape; the grammar takes characters literally, so write the character itself or drop the quotes`);
    }
    return null;
  }
  // Null and float are where this reader and a full parser would otherwise part
  // company: the parser yields `null` and `1.5`, this one would see the words.
  // Neither type is in the subset, so both refuse rather than guess.
  if (NULLISH.test(text)) {
    return err('null-not-supported', line, 'this key has no value; remove it instead of setting it to null');
  }
  if (BOOLEAN_MISSPELLED.test(text)) {
    return err('bad-boolean-spelling', line, `${text} is not a boolean here; write true or false in lower case`);
  }
  if (FLOATISH.test(text)) {
    return err('float-not-supported', line, `${text} is a decimal; the config grammar has whole numbers and strings`);
  }
  if (INTEGERISH.test(text) && !DECIMAL_INT.test(text)) {
    return err('non-decimal-integer', line, `${text} is not a plain whole number; write decimal digits with no sign, no underscores and no 0x/0o/0b prefix`);
  }
  return null;
}

/** Strip a trailing `#` comment that is not inside a quoted scalar. */
function stripComment(text) {
  let quote = '';
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '#' && (i === 0 || /\s/.test(text[i - 1]))) {
      return text.slice(0, i);
    }
  }
  return text;
}

/** A scalar, or an error. Boolean and integer are recognised; the rest is string. */
function scalar(raw, line) {
  const text = raw.trim();
  if (text === '') return { ok: true, value: '' };
  const first = text[0];
  if (first === '&' || first === '*') {
    return err('anchor-not-supported', line, 'YAML anchors and aliases are not part of the config grammar');
  }
  if (first === '!') {
    return err('tag-not-supported', line, 'YAML tags are not part of the config grammar; drop the tag and write the plain value');
  }
  if (first === '|' || first === '>') {
    return err('block-scalar-not-supported', line, 'multi-line scalars are not part of the config grammar');
  }
  if (first === '[' || first === '{') {
    return err('flow-collection-not-supported', line, 'inline lists and maps are not part of the config grammar');
  }
  const bad = outOfSubsetScalar(text, line);
  if (bad !== null) return bad;
  if (first === '"' || first === "'") return { ok: true, value: text.slice(1, -1) };
  if (text === 'true' || text === 'false') return { ok: true, value: text === 'true' };
  if (DECIMAL_INT.test(text)) return { ok: true, value: Number.parseInt(text, 10) };
  return { ok: true, value: text };
}

/**
 * `{ ok, values }` with `values` a flat object of dotted path → scalar, or
 * `{ ok: false, error: { code, line, message } }`.
 */
function parseYamlSubset(source) {
  const text = String(source).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const values = {};
  const seen = new Set();
  let parent = '';

  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const lineNo = i + 1;
    if (line.includes('\t')) return err('tab-indentation', lineNo, 'tabs are not allowed; indent with two spaces');
    const body = stripComment(line);
    if (body.trim() === '') continue;

    const indent = body.length - body.trimStart().length;
    if (indent % 2 !== 0) return err('odd-indentation', lineNo, `indentation must be a multiple of two spaces, found ${indent}`);
    const depth = indent / 2;
    if (depth > 1) return err('nesting-too-deep', lineNo, 'the config grammar allows two levels; this line is a third');

    const trimmed = body.trim();
    if (trimmed.startsWith('- ') || trimmed === '-') {
      return err('sequence-not-supported', lineNo, 'lists are not part of the config grammar');
    }
    if (trimmed.startsWith('---')) {
      return err('document-marker-not-supported', lineNo, 'document markers are not part of the config grammar');
    }

    const split = trimmed.indexOf(':');
    if (split < 1) return err('not-a-key', lineNo, `expected "key: value", found ${JSON.stringify(trimmed)}`);
    const key = trimmed.slice(0, split).trim();
    // A dot in a key is how a dotted PATH is spelled, not part of a key's name.
    // Written flat, `budget.cap: 5` is one key to this reader and a nested pair
    // to a full parser, so the flat spelling is refused on both sides instead.
    if (key !== SCHEMA_KEY && key.includes('.')) {
      const [head, ...tail] = key.split('.');
      return err('dotted-key', lineNo, `${key} is a path, not a key; write it nested — "${head}:" on its own line, then "  ${tail.join('.')}: …" indented under it`);
    }
    if (key !== SCHEMA_KEY && !KEY.test(key)) return err('bad-key', lineNo, `${JSON.stringify(key)} is not a valid config key`);

    if (depth === 0) parent = '';
    else if (parent === '') return err('orphan-nesting', lineNo, `${key} is indented but no parent key opened a map`);

    const path = depth === 0 ? key : `${parent}.${key}`;
    if (seen.has(path)) return err('duplicate-key', lineNo, `${path} is set more than once`);

    const rest = trimmed.slice(split + 1);
    if (rest.trim() === '') {
      if (depth === 1) return err('nesting-too-deep', lineNo, `${path} opens a third level; the grammar allows two`);
      parent = key;
      seen.add(path);
      continue;
    }

    const parsed = scalar(rest, lineNo);
    if (!parsed.ok) return parsed;
    seen.add(path);
    values[path] = parsed.value;
  }

  return { ok: true, values };
}

module.exports = { parseYamlSubset };
