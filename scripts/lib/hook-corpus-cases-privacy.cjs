'use strict';
// hook-corpus-cases-privacy.cjs — privacy cases, plus the six
// empty/non-JSON stdin cases for all three safety entrypoints.
//
// At BASE all six stdin cases exit 0 and print nothing. the before-state makes them exit 2 in
// the node port, so they are recorded here as the BASE baseline and excluded
// from the contract's parity set (the contract asserts the new behavior instead).

const { PROJECT_DIR_ENV: PROJ, bash, read } = require('./hook-corpus-payload.cjs');

const GATE = '.claude/hooks/gate-enforcement.sh';
const PRIVACY = '.claude/hooks/privacy-block.sh';
const PRESHIP = '.claude/hooks/pre-ship.sh';

const privacyCases = [
  {
    name: 'privacy-read-dotenv',
    stdin: read('.env'),
    setupDescription: 'BASE hook tree only',
    setup: () => {},
  },
  {
    name: 'privacy-read-webfetch-manifest',
    stdin: read('.claude/cache/web-fetches/index.jsonl'),
    setupDescription: 'BASE hook tree only',
    setup: () => {},
  },
  {
    name: 'privacy-read-webfetch-manifest-state-cache',
    stdin: read('.meowkit/cache/web-fetches/index.jsonl'),
    setupDescription: 'BASE hook tree only; the manifest at the canonical cache root',
    // The BASE tree matched only the kit-tree cache root, so it cannot produce
    // this block and this expectation is authored rather than recorded. The
    // pre-move case beside it stays recorded and unchanged, which is what proves
    // the widened pattern took nothing away.
    authoredAfterBase: 'BASE matched only the pre-move cache root, so it cannot produce this block',
    setup: () => {},
  },
  {
    name: 'privacy-read-ordinary-file',
    stdin: read('src/app.ts'),
    setupDescription: 'BASE hook tree only',
    setup: () => {},
  },
  {
    name: 'privacy-bash-reads-dotenv',
    stdin: bash('cat .env'),
    setupDescription:
      'a Bash command that reads .env. BASE checks tool_input.command only against the web-fetch patterns, so this ALLOWS — recorded as the real behavior, not the intended one',
    setup: () => {},
  },
  {
    name: 'privacy-bash-webfetch-loopback',
    stdin: bash('python3 scripts/fetch_as_markdown.py http://localhost:8080/admin'),
    setupDescription: 'a Bash web-fetch invocation aimed at a loopback address',
    setup: () => {},
  },
].map((c) => ({ group: 'privacy', entrypoint: PRIVACY, env: PROJ, ...c }));

const stdinCases = [GATE, PRIVACY, PRESHIP].flatMap((entrypoint) => {
  const short = entrypoint.replace('.claude/hooks/', '').replace('.sh', '');
  return [
    { name: `stdin-empty-${short}`, stdin: '', setupDescription: 'BASE hook tree only; stdin is an empty pipe' },
    { name: `stdin-not-json-${short}`, stdin: 'not json at all\n', setupDescription: 'BASE hook tree only; stdin is not JSON' },
  ].map((c) => ({ group: 'stdin-unreadable', entrypoint, env: PROJ, setup: () => {}, ...c }));
});

module.exports = [...privacyCases, ...stdinCases];
