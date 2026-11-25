// The web-fetch pre-check refuses a fetch aimed at a loopback, private, carrier-grade NAT,
// link-local or metadata address in any spelling `new URL` accepts (integer, hex, octal,
// upper case, a trailing root dot, bracketed IPv6), judges every URL in the command rather
// than the first, and still lets public hosts through. It is defence in depth: the fetch
// script validates its own target.
//
// Run with: node --test .claude/hooks/__tests__/

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { decidePrivacy } = require('../lib/core/privacy.cjs');

const fetchExit = (args) => decidePrivacy({ paths: [], command: `python3 .claude/skills/web-to-markdown/scripts/fetch_as_markdown.py ${args}`, toolName: 'Bash' }).exit;

const REFUSED = [
  'http://localhost/', 'http://LOCALHOST/', 'http://localhost./', 'http://app.localhost/',
  'http://127.0.0.1/', 'http://127.1/', 'http://2130706433/', 'http://0x7f000001/', 'http://0177.0.0.1/',
  'http://0.0.0.0/', 'http://10.1.2.3/', 'http://172.16.0.1/', 'http://172.31.255.255/', 'http://192.168.1.1/',
  'http://100.64.0.1/', 'http://100.127.255.255/', 'http://169.254.169.254/latest/meta-data/',
  'http://metadata.google.internal/', 'http://[::1]/', 'http://[::]/', 'http://[fc00::1]/', 'http://[fd12:3456::1]/',
  'http://[fe80::1]/', 'http://[febf::1]/', 'http://[::ffff:127.0.0.1]/', 'http://[::ffff:a9fe:a9fe]/',
  'http://user@127.0.0.1:8080/x', 'file:///etc/passwd',
];
const ALLOWED = [
  'https://example.com/', 'https://172.15.0.1/', 'https://172.32.0.1/', 'https://100.63.0.1/',
  'https://100.128.0.1/', 'https://8.8.8.8/', 'https://[2606:4700::1111]/', 'https://[fec0::1]/',
  'https://example.com/?next=http://127.0.0.1',
];

test('fetch targets at private, loopback, link-local and metadata addresses are refused in every spelling', () => {
  for (const url of REFUSED) assert.equal(fetchExit(`"${url}"`), 2, url);
});

test('public fetch targets pass', () => {
  for (const url of ALLOWED) assert.equal(fetchExit(`"${url}"`), 0, url);
});

test('every URL in the command is judged, so a safe decoy first does not hide a metadata URL', () => {
  assert.equal(fetchExit('https://example.com http://169.254.169.254/'), 2);
  assert.equal(fetchExit('https://example.com https://example.org'), 0);
});

test('a URL outside a fetch command is not judged by this check', () => {
  assert.equal(decidePrivacy({ paths: [], command: 'curl http://localhost:3000/health', toolName: 'Bash' }).exit, 0);
});
