/**
 * OrchViz — HTTP Server + SSE Broadcaster
 *
 * Core relay: SSE client management, event buffering, REST API,
 * static file serving. Follows Agent Flow's relay.ts pattern.
 */

import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';
import type { OrchEvent, SSEMessage } from '../../src/protocol.js';
import { MAX_EVENT_BUFFER, SESSION_ID_DISPLAY } from '../../src/constants.js';
import * as eventStore from '../../src/event-store.js';
import { handleHookPost, type HookReceiverOptions } from './hook-receiver.js';
import { log } from '../../src/logger.js';

// ── SSE Client Management ──

const sseClients = new Set<http.ServerResponse>();
const eventBuffer = new Map<string, OrchEvent[]>(); // sessionId → events
let activeSessionId: string | null = null;
let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

const MAX_BUFFERED_SESSIONS = 20;
const sessionLastActivity = new Map<string, number>(); // sessionId → timestamp

/** H3: Evict stale sessions from in-memory buffer. */
function evictStaleSessions(): void {
  if (eventBuffer.size <= MAX_BUFFERED_SESSIONS) return;
  // Sort by last activity, keep newest MAX_BUFFERED_SESSIONS
  const sorted = [...sessionLastActivity.entries()].sort((a, b) => a[1] - b[1]);
  const toEvict = sorted.slice(0, sorted.length - MAX_BUFFERED_SESSIONS);
  for (const [sid] of toEvict) {
    eventBuffer.delete(sid);
    sessionLastActivity.delete(sid);
    log.debug(`Evicted stale session buffer: ${sid.slice(0, 8)}`);
  }
}

/** Broadcast an OrchEvent to all SSE clients + buffer it. */
export function broadcast(event: OrchEvent): void {
  // Buffer per session (ring buffer at MAX_EVENT_BUFFER)
  const sid = event.sessionId;
  let buf = eventBuffer.get(sid) ?? [];
  buf.push(event);
  if (buf.length > MAX_EVENT_BUFFER) {
    buf = buf.slice(buf.length - MAX_EVENT_BUFFER);
  }
  eventBuffer.set(sid, buf);

  // Track active session + last activity for eviction
  activeSessionId = sid;
  sessionLastActivity.set(sid, Date.now());

  // Send to all SSE clients
  const msg: SSEMessage = { type: 'orch-event', event };
  const data = `data: ${JSON.stringify(msg)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(data);
    } catch {
      sseClients.delete(client);
    }
  }
}

// ── SSE Handler ──

// CORS headers for localhost dev (Next.js on :3601, relay on :3600)
function setCorsHeaders(res: http.ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function handleSSE(req: http.IncomingMessage, res: http.ServerResponse): void {
  setCorsHeaders(res);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  sseClients.add(res);
  log.debug(`SSE client connected (total: ${sseClients.size})`);

  // Send catch-up batch for active session
  if (activeSessionId) {
    const buffered = eventBuffer.get(activeSessionId);
    if (buffered && buffered.length > 0) {
      const batch: SSEMessage = { type: 'event-batch', events: buffered };
      res.write(`data: ${JSON.stringify(batch)}\n\n`);
    }
  }

  // Clean up on disconnect
  req.on('close', () => {
    sseClients.delete(res);
    log.debug(`SSE client disconnected (total: ${sseClients.size})`);
  });
}

// ── REST API ──

function handleAPI(
  parsed: url.UrlWithParsedQuery,
  res: http.ServerResponse,
  options: HttpServerOptions,
): void {
  const pathname = parsed.pathname ?? '';

  // GET /api/sessions — list available sessions
  if (pathname === '/api/sessions') {
    const sessions = eventStore.listSessions().map((s) => ({
      id: s.sessionId,
      label: options.getSessionLabel?.(s.sessionId) ?? `Session ${s.sessionId.slice(0, SESSION_ID_DISPLAY)}`,
      size: s.size,
      lastActivity: s.mtimeMs,
      eventCount: eventBuffer.get(s.sessionId)?.length ?? 0,
      isActive: s.sessionId === activeSessionId,
    }));
    sendJSON(res, sessions);
    return;
  }

  // C1: Validate sessionId at API boundary — prevent path traversal
  const SESSION_ID_RE = /^[a-zA-Z0-9_-]+$/;

  // GET /api/sessions/:id/events?from=byteOffset
  const eventsMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/events$/);
  if (eventsMatch) {
    const sessionId = eventsMatch[1];
    if (!SESSION_ID_RE.test(sessionId)) { sendJSON(res, { error: 'Invalid session ID' }, 400); return; }
    const fromByte = parseInt(String(parsed.query?.from ?? '0'), 10);
    const { events, newOffset } = eventStore.tailSession(sessionId, fromByte);
    sendJSON(res, { events, newOffset });
    return;
  }

  // GET /api/state — current orchestration state snapshot
  if (pathname === '/api/state') {
    evictStaleSessions();
    // Return orchestration state from state engine (Phase 3) + transport diagnostics
    const orchState = (options.stateEngine?.getSnapshot() ?? {}) as Record<string, unknown>;
    const state = {
      ...orchState,
      activeSession: activeSessionId,
      sessions: Array.from(eventBuffer.keys()),
      sseClients: sseClients.size,
      totalBuffered: Array.from(eventBuffer.values()).reduce((sum, b) => sum + b.length, 0),
    };
    sendJSON(res, state);
    return;
  }

  // GET /api/sessions/:id/agents/:name/conversation — per-agent event thread
  const convMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/agents\/([^/]+)\/conversation$/);
  if (convMatch) {
    const sessionId = convMatch[1];
    const agentName = decodeURIComponent(convMatch[2]);
    if (!SESSION_ID_RE.test(sessionId)) { sendJSON(res, { error: 'Invalid session ID' }, 400); return; }
    const snapshot = options.stateEngine?.getSnapshot() as { conversations?: Record<string, unknown[]> } | undefined;
    const events = snapshot?.conversations?.[agentName] ?? [];
    sendJSON(res, { agent: agentName, events });
    return;
  }

  // GET /api/sessions/:id/download — download session JSONL
  const dlMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/download$/);
  if (dlMatch) {
    const sessionId = dlMatch[1];
    if (!SESSION_ID_RE.test(sessionId)) { sendJSON(res, { error: 'Invalid session ID' }, 400); return; }
    const events = eventStore.readSession(sessionId);
    // M1: Sanitize sessionId in Content-Disposition header
    const safeFilename = encodeURIComponent(sessionId);
    res.writeHead(200, {
      'Content-Type': 'application/x-ndjson',
      'Content-Disposition': `attachment; filename="${safeFilename}.jsonl"`,
    });
    for (const event of events) {
      res.write(JSON.stringify(event) + '\n');
    }
    res.end();
    return;
  }

  sendJSON(res, { error: 'Not found' }, 404);
}

// ── Static File Serving ──

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function serveStatic(
  pathname: string,
  res: http.ServerResponse,
  assetsDir: string,
): void {
  const reqPath = pathname.replace(/^\/assets\//, '');
  const resolved = path.resolve(assetsDir, reqPath);

  // Path traversal protection (RT-6)
  if (!resolved.startsWith(path.resolve(assetsDir))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(resolved)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = path.extname(resolved);
  const mime = MIME_TYPES[ext] ?? 'application/octet-stream';
  const content = fs.readFileSync(resolved);
  res.writeHead(200, { 'Content-Type': mime });
  res.end(content);
}

// ── Server Factory ──

export interface HttpServerOptions {
  hookReceiverOptions: HookReceiverOptions;
  assetsDir: string;
  dashboardPath?: string;
  stateEngine?: { getSnapshot: () => unknown };
  /** Optional: resolve a human-readable label for a given session ID */
  getSessionLabel?: (sessionId: string) => string;
}

export function createHttpServer(options: HttpServerOptions): http.Server {
  const { hookReceiverOptions, assetsDir, dashboardPath } = options;

  const server = http.createServer((req, res) => {
    const parsed = url.parse(req.url ?? '/', true);
    const pathname = parsed.pathname ?? '/';

    // CORS preflight
    if (req.method === 'OPTIONS') {
      setCorsHeaders(res);
      res.writeHead(204);
      res.end();
      return;
    }

    // POST /hook — receive Claude Code hook events
    if (req.method === 'POST' && pathname === '/hook') {
      handleHookPost(req, res, hookReceiverOptions);
      return;
    }

    // GET /events — SSE stream
    if (pathname === '/events') {
      handleSSE(req, res);
      return;
    }

    // GET /api/* — REST endpoints
    if (pathname.startsWith('/api/')) {
      handleAPI(parsed, res, options);
      return;
    }

    // GET / or /orchviz — serve dashboard
    if (pathname === '/' || pathname === '/orchviz') {
      const htmlPath = dashboardPath ?? path.join(assetsDir, 'index.html');
      if (fs.existsSync(htmlPath)) {
        const content = fs.readFileSync(htmlPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body style="background:#0B0E14;color:#7DD3FC;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh"><h1>OrchViz — Dashboard not built yet. Run: pnpm build:web</h1></body></html>');
      }
      return;
    }

    // GET /assets/* — static files
    if (pathname.startsWith('/assets/')) {
      serveStatic(pathname, res, assetsDir);
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  // SSE keepalive (every 15s)
  keepaliveTimer = setInterval(() => {
    for (const client of sseClients) {
      try {
        client.write(':keepalive\n\n');
      } catch {
        sseClients.delete(client);
      }
    }
  }, 15_000);

  server.on('close', () => {
    if (keepaliveTimer) clearInterval(keepaliveTimer);
    for (const client of sseClients) {
      try { client.end(); } catch { /* noop */ }
    }
    sseClients.clear();
  });

  return server;
}

// ── Helpers ──

function sendJSON(res: http.ServerResponse, data: unknown, status = 200): void {
  setCorsHeaders(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}
