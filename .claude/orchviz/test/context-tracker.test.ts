import { describe, it, expect } from 'vitest';
import {
  createContextBreakdown,
  estimateTokens,
  addToolResultTokens,
  addReasoningTokens,
  addUserMessageTokens,
  addSubagentResultTokens,
  getTotalTokens,
  snapshotBreakdown,
} from '../src/context-tracker.js';

describe('createContextBreakdown', () => {
  it('initializes with system prompt base of 4000', () => {
    const bd = createContextBreakdown();
    expect(bd.systemPrompt).toBe(4000);
  });

  it('initializes all other categories to 0', () => {
    const bd = createContextBreakdown();
    expect(bd.userMessages).toBe(0);
    expect(bd.toolResults).toBe(0);
    expect(bd.reasoning).toBe(0);
    expect(bd.subagentResults).toBe(0);
  });

  it('total equals systemPrompt base only on creation', () => {
    const bd = createContextBreakdown();
    expect(getTotalTokens(bd)).toBe(4000);
  });
});

describe('estimateTokens', () => {
  it('estimates 3 tokens for 11-char string (ceil(11/4))', () => {
    expect(estimateTokens('hello world')).toBe(3);
  });

  it('estimates 1 for single char', () => {
    expect(estimateTokens('a')).toBe(1);
  });

  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('uses ceiling division', () => {
    // 5 chars → ceil(5/4) = 2
    expect(estimateTokens('12345')).toBe(2);
    // 4 chars → ceil(4/4) = 1
    expect(estimateTokens('1234')).toBe(1);
  });
});

describe('addToolResultTokens', () => {
  it('accumulates across multiple calls', () => {
    const bd = createContextBreakdown();
    addToolResultTokens(bd, 500);
    addToolResultTokens(bd, 300);
    expect(bd.toolResults).toBe(800);
  });

  it('reflects in total', () => {
    const bd = createContextBreakdown();
    addToolResultTokens(bd, 1000);
    expect(getTotalTokens(bd)).toBe(5000);
  });
});

describe('addReasoningTokens', () => {
  it('converts text to token estimate and accumulates', () => {
    const bd = createContextBreakdown();
    addReasoningTokens(bd, '1234'); // 4 chars → 1 token
    addReasoningTokens(bd, '12345678'); // 8 chars → 2 tokens
    expect(bd.reasoning).toBe(3);
  });
});

describe('addUserMessageTokens', () => {
  it('accumulates user message tokens', () => {
    const bd = createContextBreakdown();
    addUserMessageTokens(bd, 'hello'); // 5 chars → 2 tokens
    expect(bd.userMessages).toBe(2);
  });
});

describe('addSubagentResultTokens', () => {
  it('accumulates subagent result tokens', () => {
    const bd = createContextBreakdown();
    addSubagentResultTokens(bd, '12345678'); // 8 chars → 2 tokens
    expect(bd.subagentResults).toBe(2);
  });
});

describe('getTotalTokens', () => {
  it('sums all categories', () => {
    const bd = createContextBreakdown(); // systemPrompt = 4000
    addToolResultTokens(bd, 100);
    addUserMessageTokens(bd, '1234'); // 1 token
    addReasoningTokens(bd, '12345678'); // 2 tokens
    addSubagentResultTokens(bd, '1234'); // 1 token
    expect(getTotalTokens(bd)).toBe(4000 + 100 + 1 + 2 + 1);
  });
});

describe('snapshotBreakdown', () => {
  it('returns a shallow copy — mutations do not affect original', () => {
    const bd = createContextBreakdown();
    const snap = snapshotBreakdown(bd);
    addToolResultTokens(bd, 999);
    expect(snap.toolResults).toBe(0);
  });
});
