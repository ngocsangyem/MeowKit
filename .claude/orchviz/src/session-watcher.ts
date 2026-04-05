/**
 * OrchViz — Session Watcher
 *
 * Discovers and tails Claude Code JSONL session files at ~/.claude/projects/.
 * Follows Agent Flow's session-watcher.ts pattern: fs.watch + poll fallback.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import { TranscriptParser, readNewFileLines, type TranscriptParserDelegate } from './transcript-parser.js';
import { enrich, type EnricherState } from './orch-enricher.js';
import type { OrchEvent, HookPayload } from './protocol.js';
import { SCAN_INTERVAL_MS, POLL_FALLBACK_MS, INACTIVITY_TIMEOUT_MS } from './constants.js';
import { log } from './logger.js';
import { SubagentWatcher, type SubagentWatcherDelegate } from './subagent-watcher.js';

// C3: Import hook-active session tracking to avoid dual-source duplicates
// When hooks are active for a session, SessionWatcher skips JSONL tailing for it.
let hookActiveSessionsRef: Set<string> | null = null;

/** C3: Register the hook-active sessions set from hook-receiver. */
export function setHookActiveSessions(sessions: Set<string>): void {
  hookActiveSessionsRef = sessions;
}

const CLAUDE_DIR = path.join(os.homedir(), '.claude', 'projects');

interface WatchedSession {
  sessionId: string;
  filePath: string;
  fileSize: number;
  fileWatcher: fs.FSWatcher | null;
  pollTimer: ReturnType<typeof setInterval> | null;
  inactivityTimer: ReturnType<typeof setTimeout> | null;
  startTime: number;
  lastActivityTime: number;
  completed: boolean;
  subagentWatcher: SubagentWatcher | null;
  label: string;
}

export interface SessionWatcherOptions {
  workspace: string;
  enricherState: EnricherState;
  onEvent: (event: OrchEvent) => void;
  onSessionStart?: (sessionId: string) => void;
  onSessionEnd?: (sessionId: string) => void;
}

export class SessionWatcher {
  private sessions = new Map<string, WatchedSession>();
  private scanTimer: ReturnType<typeof setInterval> | null = null;
  private dirWatchers: fs.FSWatcher[] = [];
  private workspaceEncoded: string;
  private parsers = new Map<string, TranscriptParser>(); // C2: per-session parsers
  private parserDelegate: TranscriptParserDelegate;
  private options: SessionWatcherOptions;

  constructor(options: SessionWatcherOptions) {
    this.options = options;
    this.workspaceEncoded = encodeWorkspace(options.workspace);

    // C2: Parser delegate shared, but parser instances are per-session
    this.parserDelegate = {
      onParsedEvent: (payload: HookPayload) => {
        const event = enrich(payload, options.enricherState);
        options.onEvent(event);
      },
    };
  }

  /** C2: Get or create a per-session parser (avoids unbounded seenUuids) */
  private getParser(sessionId: string): TranscriptParser {
    let parser = this.parsers.get(sessionId);
    if (!parser) {
      parser = new TranscriptParser(this.parserDelegate);
      this.parsers.set(sessionId, parser);
    }
    return parser;
  }

  /** Start watching for sessions. */
  start(): void {
    log.info(`Watching workspace: ${this.options.workspace} (encoded: ${this.workspaceEncoded})`);

    // Initial scan
    this.scanForSessions();

    // Watch project directory for new JSONL files
    this.watchProjectDir();

    // Periodic re-scan (1s)
    this.scanTimer = setInterval(() => this.scanForSessions(), SCAN_INTERVAL_MS);
  }

  /** Get the human-readable label for a session. */
  getSessionLabel(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    return session?.label ?? `Session ${sessionId.slice(0, 8)}`;
  }

  /** Stop all watchers. */
  stop(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    for (const watcher of this.dirWatchers) {
      try { watcher.close(); } catch { /* noop */ }
    }
    this.dirWatchers = [];
    for (const [, session] of this.sessions) {
      this.cleanupSession(session);
    }
    this.sessions.clear();
  }

  private watchProjectDir(): void {
    const projectDir = path.join(CLAUDE_DIR, this.workspaceEncoded);
    if (!fs.existsSync(projectDir)) {
      log.debug(`Project dir not found: ${projectDir}`);
      return;
    }

    try {
      const watcher = fs.watch(projectDir, (_eventType, filename) => {
        if (filename?.endsWith('.jsonl')) {
          this.scanForSessions();
        }
      });
      this.dirWatchers.push(watcher);
    } catch (err) {
      log.warn('Failed to watch project dir:', (err as Error).message);
    }
  }

  private scanForSessions(): void {
    const projectDir = path.join(CLAUDE_DIR, this.workspaceEncoded);
    if (!fs.existsSync(projectDir)) return;

    let files: string[];
    try {
      files = fs.readdirSync(projectDir).filter((f) => f.endsWith('.jsonl'));
    } catch {
      return;
    }

    for (const file of files) {
      const sessionId = file.replace('.jsonl', '');
      if (this.sessions.has(sessionId)) continue;

      const filePath = path.join(projectDir, file);
      try {
        const stat = fs.statSync(filePath);
        // Only watch recently active files (< 10 min old)
        const ageMs = Date.now() - stat.mtimeMs;
        if (ageMs > 10 * 60 * 1000) continue;

        this.watchSession(sessionId, filePath);
      } catch {
        // File may have been removed between readdir and stat
      }
    }
  }

  private watchSession(sessionId: string, filePath: string): void {
    log.info(`Watching session: ${sessionId.slice(0, 8)}`);

    const session: WatchedSession = {
      sessionId,
      filePath,
      fileSize: 0,
      fileWatcher: null,
      pollTimer: null,
      inactivityTimer: null,
      startTime: Date.now(),
      lastActivityTime: Date.now(),
      completed: false,
      subagentWatcher: null,
      label: `Session ${sessionId.slice(0, 8)}`,
    };

    this.sessions.set(sessionId, session);
    this.options.onSessionStart?.(sessionId);

    // Pre-scan existing content for dedup
    try {
      const stat = fs.statSync(filePath);
      if (stat.size > 0) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parser = this.getParser(sessionId);
        parser.prescan(content);
        session.fileSize = stat.size;
        // Set label from pre-scan result
        const extracted = parser.getLabel();
        if (extracted) session.label = extracted;
      }
    } catch {
      // File may be empty or unreadable
    }

    // Watch for new content
    try {
      session.fileWatcher = fs.watch(filePath, () => {
        this.readNewLines(session);
      });
    } catch {
      log.warn(`Failed to watch file: ${filePath}`);
    }

    // Poll fallback (macOS fs.watch unreliable)
    session.pollTimer = setInterval(() => {
      this.readNewLines(session);
    }, POLL_FALLBACK_MS);

    // Subagent watcher — discovers and tails subagent JSONL files
    const subagentsDir = path.join(path.dirname(filePath), sessionId, 'subagents');
    const subagentDelegate: SubagentWatcherDelegate = {
      onSubagentSpawn: (agentName, agentType, sid) => {
        const payload = {
          session_id: sid,
          hook_event_name: 'SubagentStart',
          agent_type: agentType,
          agent_id: agentName,
        };
        const event = enrich(payload, this.options.enricherState);
        this.options.onEvent(event);
      },
      onSubagentEvent: (_agentName, payload, sid) => {
        const hookPayload = {
          session_id: sid,
          hook_event_name: String(payload.type ?? 'Message'),
          message: payload.message as string | undefined,
        };
        const event = enrich(hookPayload, this.options.enricherState);
        this.options.onEvent(event);
      },
    };
    session.subagentWatcher = new SubagentWatcher(
      subagentsDir,
      sessionId,
      this.parserDelegate,
      subagentDelegate,
    );
    session.subagentWatcher.start();

    // Inactivity timeout
    this.resetInactivityTimer(session);
  }

  private readNewLines(session: WatchedSession): void {
    // C3: Skip if hooks are active for this session (avoid duplicates)
    if (hookActiveSessionsRef?.has(session.sessionId)) return;

    const result = readNewFileLines(session.filePath, session.fileSize);
    if (!result) return;

    session.fileSize = result.newSize;
    session.lastActivityTime = Date.now();

    const parser = this.getParser(session.sessionId);
    for (const line of result.lines) {
      parser.processLine(line, session.sessionId);
    }

    // Update label if not yet extracted (e.g. label arrived in new lines)
    if (session.label === `Session ${session.sessionId.slice(0, 8)}`) {
      const extracted = parser.getLabel();
      if (extracted) session.label = extracted;
    }

    // Also scan subagent directory for new files
    session.subagentWatcher?.scanDir();

    this.resetInactivityTimer(session);
  }

  private resetInactivityTimer(session: WatchedSession): void {
    if (session.inactivityTimer) clearTimeout(session.inactivityTimer);

    session.inactivityTimer = setTimeout(() => {
      if (!session.completed) {
        session.completed = true;
        log.info(`Session ${session.sessionId.slice(0, 8)} timed out (inactivity)`);
        this.options.onSessionEnd?.(session.sessionId);
        // Clean up resources (watchers, timers, parsers) to prevent leaks
        this.cleanupSession(session);
        this.sessions.delete(session.sessionId);
      }
    }, INACTIVITY_TIMEOUT_MS);
  }

  private cleanupSession(session: WatchedSession): void {
    if (session.fileWatcher) {
      try { session.fileWatcher.close(); } catch { /* noop */ }
    }
    if (session.pollTimer) clearInterval(session.pollTimer);
    if (session.inactivityTimer) clearTimeout(session.inactivityTimer);
    session.subagentWatcher?.stop();
    // C2: Clean up per-session parser to free seenUuids memory
    this.parsers.delete(session.sessionId);
  }
}

// ── Utility ──

function encodeWorkspace(workspace: string): string {
  // Same encoding as Claude Code: replace non-alphanumeric with '-'
  try {
    const resolved = fs.realpathSync(workspace);
    return resolved.replace(/[^a-zA-Z0-9]/g, '-');
  } catch {
    return workspace.replace(/[^a-zA-Z0-9]/g, '-');
  }
}
