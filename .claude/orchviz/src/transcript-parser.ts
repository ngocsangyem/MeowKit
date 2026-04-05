/**
 * OrchViz — Transcript Parser
 *
 * Tails Claude Code JSONL transcripts at ~/.claude/projects/ as a fallback
 * data source when hooks are unavailable (RT-11).
 *
 * Follows Agent Flow's delegate-based TranscriptParser pattern:
 * parser is decoupled from file-watching via a delegate interface.
 */

import * as fs from 'node:fs';
import type { HookPayload } from './protocol.js';
import { RESULT_MAX, ARGS_MAX } from './constants.js';
import { log } from './logger.js';

// ── Delegate Interface ──

export interface TranscriptParserDelegate {
  /** Called when a parseable event is extracted from a JSONL line */
  onParsedEvent(payload: HookPayload): void;
}

// ── Transcript Entry (Claude Code JSONL format) ──

interface TranscriptEntry {
  sessionId?: string;
  type?: string; // 'user', 'assistant', 'progress'
  uuid?: string;
  cwd?: string;
  message?: {
    role?: string;
    model?: string;
    content?: TranscriptContentBlock[] | string;
  };
}

type TranscriptContentBlock =
  | { type: 'tool_use'; name: string; id: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: unknown }
  | { type: 'thinking'; thinking: string }
  | { type: 'text'; text: string };

// ── Parser ──

export class TranscriptParser {
  private delegate: TranscriptParserDelegate;
  private seenUuids = new Set<string>();
  private pendingToolCalls = new Map<string, { name: string; args: string }>();

  constructor(delegate: TranscriptParserDelegate) {
    this.delegate = delegate;
  }

  /**
   * Process a single JSONL line from a Claude Code transcript.
   * Extracts tool_use, tool_result, and message events, converting
   * them into HookPayload-compatible objects for the enricher.
   */
  processLine(line: string, sessionId: string): void {
    if (!line.trim()) return;

    let entry: TranscriptEntry;
    try {
      entry = JSON.parse(line);
    } catch {
      return; // Skip malformed lines
    }

    // Dedup by UUID
    if (entry.uuid) {
      if (this.seenUuids.has(entry.uuid)) return;
      this.seenUuids.add(entry.uuid);
    }

    // Skip non-conversation entries
    if (entry.type !== 'user' && entry.type !== 'assistant') return;

    const content = entry.message?.content;
    if (!content) return;

    // String content → message event
    if (typeof content === 'string') {
      this.delegate.onParsedEvent({
        session_id: sessionId,
        hook_event_name: 'Message',
        message: content.slice(0, RESULT_MAX),
      });
      return;
    }

    // Array content → process each block
    for (const block of content) {
      this.processBlock(block, sessionId, entry.message?.role);
    }
  }

  private processBlock(
    block: TranscriptContentBlock,
    sessionId: string,
    role?: string,
  ): void {
    switch (block.type) {
      case 'tool_use':
        this.handleToolUse(block, sessionId);
        break;
      case 'tool_result':
        this.handleToolResult(block, sessionId);
        break;
      case 'text':
        if (block.text) {
          this.delegate.onParsedEvent({
            session_id: sessionId,
            hook_event_name: 'Message',
            message: block.text.slice(0, RESULT_MAX),
          });
        }
        break;
      case 'thinking':
        if (block.thinking) {
          this.delegate.onParsedEvent({
            session_id: sessionId,
            hook_event_name: 'Message',
            message: block.thinking.slice(0, RESULT_MAX),
          });
        }
        break;
    }
  }

  private handleToolUse(
    block: { type: 'tool_use'; name: string; id: string; input: Record<string, unknown> },
    sessionId: string,
  ): void {
    const args = summarizeInput(block.name, block.input);
    this.pendingToolCalls.set(block.id, { name: block.name, args });

    this.delegate.onParsedEvent({
      session_id: sessionId,
      hook_event_name: 'PreToolUse',
      tool_name: block.name,
      tool_use_id: block.id,
      tool_input: block.input,
    });

    // Detect Agent/Task tool calls → subagent dispatch
    if (block.name === 'Agent' || block.name === 'Task') {
      const agentType =
        (block.input.subagent_type as string) ??
        (block.input.description as string) ??
        'subagent';
      this.delegate.onParsedEvent({
        session_id: sessionId,
        hook_event_name: 'SubagentStart',
        agent_type: agentType,
        agent_id: block.id.slice(-8),
      });
    }
  }

  private handleToolResult(
    block: { type: 'tool_result'; tool_use_id: string; content: unknown },
    sessionId: string,
  ): void {
    const pending = this.pendingToolCalls.get(block.tool_use_id);
    if (!pending) return;
    this.pendingToolCalls.delete(block.tool_use_id);

    const result = summarizeResult(block.content);

    this.delegate.onParsedEvent({
      session_id: sessionId,
      hook_event_name: 'PostToolUse',
      tool_name: pending.name,
      tool_use_id: block.tool_use_id,
      tool_response: result,
    });
  }

  /** Pre-scan existing content to build dedup sets (for catch-up). */
  prescan(content: string): void {
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line) as TranscriptEntry;
        if (entry.uuid) this.seenUuids.add(entry.uuid);
      } catch {
        // Skip
      }
    }
  }

  /** Reset parser state (for new session). */
  reset(): void {
    this.seenUuids.clear();
    this.pendingToolCalls.clear();
  }
}

// ── Utility: summarize tool input/output ──

function summarizeInput(toolName: string, input: Record<string, unknown>): string {
  const filePath = (input.file_path ?? input.path ?? input.command) as string | undefined;
  if (filePath) return `${toolName}: ${String(filePath).slice(0, ARGS_MAX)}`;
  const pattern = input.pattern as string | undefined;
  if (pattern) return `${toolName}: ${pattern.slice(0, ARGS_MAX)}`;
  const desc = input.description as string | undefined;
  if (desc) return desc.slice(0, ARGS_MAX);
  return toolName;
}

function summarizeResult(content: unknown): string {
  if (typeof content === 'string') return content.slice(0, RESULT_MAX);
  if (Array.isArray(content)) {
    const text = content
      .map((c) => (typeof c === 'object' && c && 'text' in c ? (c as { text: string }).text : ''))
      .join(' ');
    return text.slice(0, RESULT_MAX);
  }
  if (content && typeof content === 'object' && 'text' in content) {
    return String((content as { text: string }).text).slice(0, RESULT_MAX);
  }
  return '';
}

// ── File Tailing Utility ──

/**
 * Read new lines from a file starting at a byte offset.
 * Returns null if no new content. Follows Agent Flow's fs-utils pattern.
 */
export function readNewFileLines(
  filePath: string,
  lastSize: number,
): { lines: string[]; newSize: number } | null {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return null;
  }

  // File truncated — reset
  if (stat.size < lastSize) return { lines: [], newSize: 0 };
  // No new content
  if (stat.size <= lastSize) return null;

  const fd = fs.openSync(filePath, 'r');
  try {
    const length = stat.size - lastSize;
    const buf = Buffer.alloc(length);
    fs.readSync(fd, buf, 0, length, lastSize);
    const lines = buf.toString('utf-8').split('\n').filter(Boolean);
    return { lines, newSize: stat.size };
  } finally {
    fs.closeSync(fd);
  }
}
