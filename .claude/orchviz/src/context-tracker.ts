/**
 * OrchViz — Context & Token Breakdown Tracker
 *
 * Tracks token usage by category per agent session.
 * Plain objects only — fully JSON-serializable (no Maps).
 */

// ── Types ──

export interface ContextBreakdown {
  /** Base system prompt tokens (estimated constant) */
  systemPrompt: number;
  /** User input tokens */
  userMessages: number;
  /** Tool response tokens */
  toolResults: number;
  /** Thinking / extended thinking tokens */
  reasoning: number;
  /** Subagent return tokens */
  subagentResults: number;
}

// ── Factory ──

export function createContextBreakdown(): ContextBreakdown {
  return {
    systemPrompt: 4000,
    userMessages: 0,
    toolResults: 0,
    reasoning: 0,
    subagentResults: 0,
  };
}

// ── Estimation ──

/**
 * Rough token estimate: ~4 chars per token (industry heuristic).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ── Mutators ──

export function addToolResultTokens(breakdown: ContextBreakdown, tokenCost: number): void {
  breakdown.toolResults += tokenCost;
}

export function addReasoningTokens(breakdown: ContextBreakdown, text: string): void {
  breakdown.reasoning += estimateTokens(text);
}

export function addUserMessageTokens(breakdown: ContextBreakdown, text: string): void {
  breakdown.userMessages += estimateTokens(text);
}

export function addSubagentResultTokens(breakdown: ContextBreakdown, text: string): void {
  breakdown.subagentResults += estimateTokens(text);
}

// ── Aggregation ──

export function getTotalTokens(breakdown: ContextBreakdown): number {
  return (
    breakdown.systemPrompt +
    breakdown.userMessages +
    breakdown.toolResults +
    breakdown.reasoning +
    breakdown.subagentResults
  );
}

/** Return a shallow copy snapshot (safe for serialization). */
export function snapshotBreakdown(breakdown: ContextBreakdown): ContextBreakdown {
  return { ...breakdown };
}
