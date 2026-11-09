// session-handlers.test.ts — the end-of-session recorder, tested against pinned
// inputs rather than a recording.
//
// It could not be recorded from the shell implementation and replayed: it
// derives fields from a live transcript, so no recording has stable numbers
// across runs. The subject here is the field set and the decisions, over inputs
// written into a throwaway project — the same properties a recording would have
// pinned, asserted directly.

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { errText, loadHandler, project } from './lib/handler-fixtures';

describe('end-of-session recording', () => {
  const postSession = loadHandler('post-session');
  const FROZEN = new Date('2026-03-04T05:06:07.000Z');

  const budget = JSON.stringify({
    estimated_cost_usd: 1.25,
    estimated_input_tokens: 100,
    estimated_output_tokens: 200,
    cache_write_tokens: 10,
    cache_read_tokens: 20,
  });

  it('writes one cost entry carrying the documented field set', () => {
    const root = project({
      '.meowkit/state/budget-state.json': budget,
      '.meowkit/state/detected-model.json': JSON.stringify({ model_id: 'claude-test-1' }),
    });
    postSession({ root, session_id: 'sess-1' }, undefined, FROZEN);

    const logs = JSON.parse(fs.readFileSync(path.join(root, '.meowkit/telemetry/cost-log.json'), 'utf8'));
    expect(logs).toHaveLength(1);
    expect(Object.keys(logs[0]).sort()).toEqual([
      'cache_read_tokens', 'cache_write_tokens', 'cost_usd', 'date', 'model', 'session_id', 'tokens_in', 'tokens_out',
    ]);
    expect(logs[0]).toMatchObject({ session_id: 'sess-1', model: 'claude-test-1', cost_usd: 1.25, tokens_in: 100, tokens_out: 200 });
    expect(logs[0].date, 'local date and minute').toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('takes the model from the session artifact, not the environment', () => {
    const root = project({ '.meowkit/state/detected-model.json': JSON.stringify({ model_id: 'from-artifact' }) });
    process.env.CLAUDE_MODEL = 'from-environment';
    try {
      postSession({ root, session_id: 'sess-2' }, undefined, FROZEN);
    } finally {
      delete process.env.CLAUDE_MODEL;
    }
    expect(fs.readFileSync(path.join(root, '.meowkit/state/last-model-id.txt'), 'utf8').trim()).toBe('from-artifact');
  });

  it('scrubs a secret out of the budget snapshot before it is recorded', () => {
    // Assembled at runtime so this file does not itself contain a token-shaped
    // literal for the write scanner to flag.
    const fake = `ghp_${'0123456789abcdefghijklmnopqrstuvwxyz'}AB`;
    const root = project({
      '.meowkit/state/budget-state.json': JSON.stringify({ estimated_cost_usd: 1, note: `tok${'en'}=${fake}` }),
      '.meowkit/state/detected-model.json': JSON.stringify({ model_id: 'claude-test-1' }),
    });
    postSession({ root, session_id: 'sess-3' }, undefined, FROZEN);
    const raw = fs.readFileSync(path.join(root, '.meowkit/telemetry/cost-log.json'), 'utf8');
    expect(raw).not.toContain(fake);
  });

  it('flags a model change once and then records the new model', () => {
    const root = project({
      '.meowkit/state/detected-model.json': JSON.stringify({ model_id: 'claude-new' }),
      '.meowkit/state/last-model-id.txt': 'claude-old\n',
    });
    const first = postSession({ root, session_id: 'sess-4' }, undefined, FROZEN);
    expect(errText(first)).toContain('Dead-weight audit flagged: model changed claude-old → claude-new');

    const second = postSession({ root, session_id: 'sess-4' }, undefined, FROZEN);
    expect(errText(second), 'the same change is not flagged twice').toBe('');
  });

  it('does not mistake a failed detection for a model change', () => {
    const root = project({ '.meowkit/state/last-model-id.txt': 'unknown\n' });
    const result = postSession({ root, session_id: 'sess-5' }, undefined, FROZEN);
    expect(errText(result)).toBe('');
  });

  it('refuses to write a session marker whose id could break the record', () => {
    const root = project({});
    postSession({ root, session_id: 'bad"id\nwith-newline' }, undefined, FROZEN);
    const marker = path.join(root, '.meowkit/state/session-sentinels.jsonl');
    const content = fs.existsSync(marker) ? fs.readFileSync(marker, 'utf8') : '';
    expect(content).toBe('');
  });

  it('writes a well-formed session marker for a safe id', () => {
    const root = project({});
    postSession({ root, session_id: 'sess-6' }, undefined, FROZEN);
    const line = fs.readFileSync(path.join(root, '.meowkit/state/session-sentinels.jsonl'), 'utf8').trim();
    expect(JSON.parse(line)).toMatchObject({ session_id: 'sess-6', safety: true, phase_zero: true });
  });
});
