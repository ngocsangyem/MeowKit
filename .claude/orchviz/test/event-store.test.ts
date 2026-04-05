import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { append, readSession, tailSession, listSessions, cleanup, closeAll } from '../src/event-store.js';
import type { OrchEvent } from '../src/protocol.js';

const STORE_ROOT = path.join(os.homedir(), '.claude', 'orchviz', 'sessions');
const TEST_SESSION = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function makeEvent(seq: number, partial?: Partial<OrchEvent>): OrchEvent {
  return {
    seq,
    timestamp: Date.now(),
    sessionId: TEST_SESSION,
    eventType: 'tool_call_start',
    redactedPayload: { tool_name: 'Read' },
    agent: null,
    workflowStep: 'unknown',
    planContext: null,
    taskContext: null,
    toolContext: null,
    statusProtocol: null,
    contextBreakdown: null,
    fileAttention: null,
    ...partial,
  };
}

function cleanTestFile(): void {
  const filePath = path.join(STORE_ROOT, `${TEST_SESSION}.jsonl`);
  try { fs.unlinkSync(filePath); } catch { /* noop */ }
}

describe('event-store', () => {
  beforeEach(() => {
    closeAll();
    cleanTestFile();
  });

  afterEach(() => {
    closeAll();
    cleanTestFile();
  });

  it('appends and reads events', async () => {
    const e1 = makeEvent(1, { eventType: 'agent_spawn' });
    const e2 = makeEvent(2, { eventType: 'tool_call_start' });
    const e3 = makeEvent(3, { eventType: 'tool_call_end' });

    append(TEST_SESSION, e1);
    append(TEST_SESSION, e2);
    append(TEST_SESSION, e3);

    // Wait for writes to flush
    await new Promise((r) => setTimeout(r, 100));

    const events = readSession(TEST_SESSION);
    expect(events).toHaveLength(3);
    expect(events[0].seq).toBe(1);
    expect(events[0].eventType).toBe('agent_spawn');
    expect(events[2].seq).toBe(3);
  });

  it('tails from byte offset', async () => {
    // Write initial events
    append(TEST_SESSION, makeEvent(1));
    append(TEST_SESSION, makeEvent(2));
    await new Promise((r) => setTimeout(r, 100));

    // Record offset
    const filePath = path.join(STORE_ROOT, `${TEST_SESSION}.jsonl`);
    const stat = fs.statSync(filePath);
    const offset = stat.size;

    // Write more events
    append(TEST_SESSION, makeEvent(3));
    append(TEST_SESSION, makeEvent(4));
    await new Promise((r) => setTimeout(r, 100));

    // Tail from offset — should only get events 3 and 4
    const { events, newOffset } = tailSession(TEST_SESSION, offset);
    expect(events).toHaveLength(2);
    expect(events[0].seq).toBe(3);
    expect(events[1].seq).toBe(4);
    expect(newOffset).toBeGreaterThan(offset);
  });

  it('returns empty for non-existent session', () => {
    const events = readSession('nonexistent-session-xyz');
    expect(events).toEqual([]);
  });

  it('tailSession returns empty when no new content', async () => {
    append(TEST_SESSION, makeEvent(1));
    await new Promise((r) => setTimeout(r, 100));

    const filePath = path.join(STORE_ROOT, `${TEST_SESSION}.jsonl`);
    const stat = fs.statSync(filePath);
    const { events } = tailSession(TEST_SESSION, stat.size);
    expect(events).toEqual([]);
  });

  it('listSessions includes test session', async () => {
    append(TEST_SESSION, makeEvent(1));
    await new Promise((r) => setTimeout(r, 100));

    const sessions = listSessions();
    const found = sessions.find((s) => s.sessionId === TEST_SESSION);
    expect(found).toBeDefined();
    expect(found!.size).toBeGreaterThan(0);
  });

  it('cleanup removes old files', async () => {
    append(TEST_SESSION, makeEvent(1));
    await new Promise((r) => setTimeout(r, 100));
    closeAll();

    // Set mtime to 1 hour ago
    const filePath = path.join(STORE_ROOT, `${TEST_SESSION}.jsonl`);
    const past = new Date(Date.now() - 3600_000);
    fs.utimesSync(filePath, past, past);

    const removed = cleanup(1800_000); // 30 min max age
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(filePath)).toBe(false);
  });
});
