/**
 * OrchViz — Event Store
 *
 * Async JSONL append/tail per session using WriteStream (RT-7).
 * Stores enriched OrchEvents at ~/.claude/orchviz/sessions/{sessionId}.jsonl
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { OrchEvent } from './protocol.js';
import { STORE_DIR_NAME } from './constants.js';
import { log } from './logger.js';

const STORE_ROOT = path.join(os.homedir(), '.claude', 'orchviz', STORE_DIR_NAME);

// ── WriteStream Cache ──
// One WriteStream per session, kept open for the session's lifetime.

const streams = new Map<string, fs.WriteStream>();

function ensureStoreDir(): void {
  if (!fs.existsSync(STORE_ROOT)) {
    fs.mkdirSync(STORE_ROOT, { recursive: true });
  }
}

function getStream(sessionId: string): fs.WriteStream {
  let stream = streams.get(sessionId);
  if (stream && !stream.destroyed) return stream;

  ensureStoreDir();
  const filePath = path.join(STORE_ROOT, `${sessionId}.jsonl`);
  stream = fs.createWriteStream(filePath, { flags: 'a', encoding: 'utf-8' });

  stream.on('error', (err) => {
    log.error(`WriteStream error for session ${sessionId}:`, err.message);
    streams.delete(sessionId);
  });

  streams.set(sessionId, stream);
  return stream;
}

// ── Public API ──

/** Append an enriched event to the session's JSONL file (async, non-blocking). */
export function append(sessionId: string, event: OrchEvent): void {
  const stream = getStream(sessionId);
  const line = JSON.stringify(event) + '\n';

  // write() returns false if internal buffer is full — we don't await drain
  // because hooks must never block. Events may be dropped under extreme load.
  if (!stream.write(line)) {
    log.debug(`WriteStream backpressure for session ${sessionId}`);
  }
}

/** Read all events for a session. Returns empty array if file doesn't exist. */
export function readSession(sessionId: string): OrchEvent[] {
  const filePath = path.join(STORE_ROOT, `${sessionId}.jsonl`);
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, 'utf-8');
  const events: OrchEvent[] = [];
  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      log.warn(`Malformed JSONL line in ${sessionId}`);
    }
  }
  return events;
}

/**
 * Tail a session from a byte offset. Returns new events + updated offset.
 * Used for catch-up when clients reconnect.
 */
export function tailSession(
  sessionId: string,
  fromByte: number,
): { events: OrchEvent[]; newOffset: number } {
  const filePath = path.join(STORE_ROOT, `${sessionId}.jsonl`);
  if (!fs.existsSync(filePath)) return { events: [], newOffset: 0 };

  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return { events: [], newOffset: fromByte };
  }

  // H1: Check truncation FIRST (strict less-than), then no-new-content
  if (stat.size < fromByte) {
    // File was truncated — reset offset to re-read from start
    return { events: [], newOffset: 0 };
  }
  if (stat.size === fromByte) {
    return { events: [], newOffset: fromByte };
  }

  const fd = fs.openSync(filePath, 'r');
  try {
    const length = stat.size - fromByte;
    const buf = Buffer.alloc(length);
    fs.readSync(fd, buf, 0, length, fromByte);
    const content = buf.toString('utf-8');
    const events: OrchEvent[] = [];
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try {
        events.push(JSON.parse(line));
      } catch {
        // Skip malformed lines
      }
    }
    return { events, newOffset: stat.size };
  } finally {
    fs.closeSync(fd);
  }
}

/** List available sessions with metadata. */
export function listSessions(): Array<{
  sessionId: string;
  size: number;
  mtimeMs: number;
}> {
  ensureStoreDir();
  const files = fs.readdirSync(STORE_ROOT).filter((f) => f.endsWith('.jsonl'));
  return files.map((f) => {
    const stat = fs.statSync(path.join(STORE_ROOT, f));
    return {
      sessionId: f.replace('.jsonl', ''),
      size: stat.size,
      mtimeMs: stat.mtimeMs,
    };
  });
}

/** Remove session files older than maxAgeMs. */
export function cleanup(maxAgeMs: number): number {
  ensureStoreDir();
  const now = Date.now();
  let removed = 0;
  const files = fs.readdirSync(STORE_ROOT).filter((f) => f.endsWith('.jsonl'));

  for (const f of files) {
    const filePath = path.join(STORE_ROOT, f);
    try {
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > maxAgeMs) {
        // Close stream if open
        const sessionId = f.replace('.jsonl', '');
        const stream = streams.get(sessionId);
        if (stream) {
          stream.end();
          streams.delete(sessionId);
        }
        fs.unlinkSync(filePath);
        removed++;
      }
    } catch {
      // Skip files we can't stat/remove
    }
  }

  if (removed > 0) log.info(`Cleaned up ${removed} old session files`);
  return removed;
}

/** Close all open WriteStreams (for graceful shutdown). */
export function closeAll(): void {
  for (const [id, stream] of streams) {
    stream.end();
    streams.delete(id);
  }
}
