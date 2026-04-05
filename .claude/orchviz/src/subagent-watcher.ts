/**
 * OrchViz — Subagent Watcher
 *
 * Discovers and tails subagent JSONL files under:
 *   ~/.claude/projects/{workspace}/{sessionId}/subagents/
 *
 * Follows Agent Flow's subagent-watcher.ts pattern:
 * reads .meta.json for name, emits agent_spawn only for active subagents,
 * and defers to inlineProgressAgents set to avoid duplicate events.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { TranscriptParser, readNewFileLines, type TranscriptParserDelegate } from './transcript-parser.js';
import { POLL_FALLBACK_MS } from './constants.js';
import { log } from './logger.js';
import { handlePermissionDetection, type PermissionState, type PendingToolCall } from './permission-detection.js';

interface SubagentState {
  filePath: string;
  agentName: string;
  fileSize: number;
  watcher: fs.FSWatcher | null;
  parser: TranscriptParser; // per-subagent — avoids unbounded seenUuids
  pendingToolCalls: Map<string, PendingToolCall>;
  spawnEmitted: boolean;
  permissionTimer: ReturnType<typeof setTimeout> | null;
  permissionEmitted: boolean;
}

export interface SubagentWatcherDelegate {
  onSubagentSpawn(agentName: string, agentType: string, sessionId: string): void;
  onSubagentEvent(agentName: string, payload: Record<string, unknown>, sessionId: string): void;
}

/** Read .meta.json sidecar; return resolved name or fallback. */
function resolveNameFromMeta(filePath: string, index: number): string {
  try {
    const meta = JSON.parse(fs.readFileSync(filePath.replace(/\.jsonl$/, '.meta.json'), 'utf-8')) as Record<string, unknown>;
    const name = String(meta.description ?? meta.subagent_type ?? '').trim();
    if (name && name !== 'subagent') return name;
  } catch { /* meta file may not exist */ }
  return `subagent-${index}`;
}

/** Scan existing content; return count of unmatched tool_use IDs (pending work). */
function countPendingWork(filePath: string, parser: TranscriptParser): { pendingCount: number; fileSize: number } {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size === 0) return { pendingCount: 0, fileSize: 0 };
    const content = fs.readFileSync(filePath, 'utf-8');
    parser.prescan(content);
    const pending = new Set<string>();
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line) as { message?: { content?: Array<{ type: string; id?: string; tool_use_id?: string }> } };
        for (const b of entry.message?.content ?? []) {
          if (b.type === 'tool_use' && b.id) pending.add(b.id);
          else if (b.type === 'tool_result' && b.tool_use_id) pending.delete(b.tool_use_id);
        }
      } catch { /* skip unparseable lines */ }
    }
    return { pendingCount: pending.size, fileSize: stat.size };
  } catch { return { pendingCount: 0, fileSize: 0 }; }
}

export class SubagentWatcher {
  private subagents = new Map<string, SubagentState>(); // filePath → state
  private dirWatcher: fs.FSWatcher | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  /** Subagents handled by inline progress — file events skipped to avoid duplicates */
  inlineProgressAgents = new Set<string>();

  constructor(
    private subagentsDir: string,
    private sessionId: string,
    private parserDelegate: TranscriptParserDelegate,
    private delegate: SubagentWatcherDelegate,
  ) {}

  start(): void {
    if (fs.existsSync(this.subagentsDir)) this.watchDir();
    this.scanDir();
    this.pollTimer = setInterval(() => this.scanDir(), POLL_FALLBACK_MS);
  }

  private watchDir(): void {
    if (this.dirWatcher) return;
    try { this.dirWatcher = fs.watch(this.subagentsDir, () => this.scanDir()); }
    catch (err) { log.debug('Subagent dir watch failed:', (err as Error).message); }
  }

  scanDir(): void {
    if (!fs.existsSync(this.subagentsDir)) return;
    if (!this.dirWatcher) this.watchDir();
    let files: string[];
    try { files = fs.readdirSync(this.subagentsDir); } catch { return; }
    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;
      const filePath = path.join(this.subagentsDir, file);
      if (!this.subagents.has(filePath)) this.startWatchingFile(filePath);
    }
  }

  private startWatchingFile(filePath: string): void {
    const agentName = resolveNameFromMeta(filePath, this.subagents.size + 1);
    log.info(`Tailing subagent: ${path.basename(filePath)} as "${agentName}"`);

    const parser = new TranscriptParser(this.parserDelegate);
    const { pendingCount, fileSize } = countPendingWork(filePath, parser);
    const state: SubagentState = {
      filePath, agentName, fileSize, watcher: null, parser,
      pendingToolCalls: new Map(), spawnEmitted: pendingCount > 0,
      permissionTimer: null, permissionEmitted: false,
    };
    this.subagents.set(filePath, state);

    if (pendingCount > 0) this.delegate.onSubagentSpawn(agentName, agentName, this.sessionId);

    try { state.watcher = fs.watch(filePath, () => this.readNewLines(state)); }
    catch (err) { log.debug('Subagent file watch failed:', (err as Error).message); }
  }

  private readNewLines(state: SubagentState): void {
    const result = readNewFileLines(state.filePath, state.fileSize);
    if (!result) return;
    state.fileSize = result.newSize;

    // Inline progress handles this agent — advance position only, skip emit
    if (this.inlineProgressAgents.has(state.agentName)) return;

    if (!state.spawnEmitted) {
      state.spawnEmitted = true;
      this.delegate.onSubagentSpawn(state.agentName, state.agentName, this.sessionId);
    }
    for (const line of result.lines) {
      state.parser.processLine(line, this.sessionId);
      // Track pending tool calls for permission detection
      try {
        const entry = JSON.parse(line);
        if (entry.message?.content && Array.isArray(entry.message.content)) {
          for (const block of entry.message.content) {
            if (block.type === 'tool_use' && block.id) {
              state.pendingToolCalls.set(block.id, { name: block.name, startTime: Date.now() });
            } else if (block.type === 'tool_result' && block.tool_use_id) {
              state.pendingToolCalls.delete(block.tool_use_id);
            }
          }
        }
      } catch { /* skip malformed */ }
    }

    const permState: PermissionState = { permissionTimer: state.permissionTimer, permissionEmitted: state.permissionEmitted };
    handlePermissionDetection(state.agentName, state.pendingToolCalls, permState, (type, payload) => {
      this.delegate.onSubagentEvent(state.agentName, { type, ...payload }, this.sessionId);
    });
    state.permissionTimer = permState.permissionTimer;
    state.permissionEmitted = permState.permissionEmitted;
  }

  stop(): void {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
    if (this.dirWatcher) { try { this.dirWatcher.close(); } catch { /* noop */ } this.dirWatcher = null; }
    for (const s of this.subagents.values()) {
      if (s.watcher) { try { s.watcher.close(); } catch { /* noop */ } }
      if (s.permissionTimer) clearTimeout(s.permissionTimer);
    }
    this.subagents.clear();
  }
}
