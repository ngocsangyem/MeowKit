#!/usr/bin/env node

/**
 * Sequential Thinking Thought Processor
 * Validates, tracks, and manages sequential thoughts with revision/branching.
 *
 * Usage:
 *   node process-thought.js --thought "Analysis" --number 1 --total 5 --next true
 *   node process-thought.js --thought "Revision" --number 2 --total 5 --next true --revision 1
 *   node process-thought.js --thought "Branch" --number 3 --total 5 --next true --branch 2 --branchId "a"
 *   node process-thought.js --summary    # condensed history for handoff
 *   node process-thought.js --history    # full history
 *   node process-thought.js --reset      # clear history
 *
 * Improvements over CK version:
 *   - Max thought limit (20) prevents infinite loops
 *   - Input sanitization (trim, length check)
 *   - --summary flag for context-efficient handoff
 *
 * Source: claudekit-engineer/sequential-thinking (MIT, improved)
 */

const fs = require('fs');
const path = require('path');

const HISTORY_FILE = path.join(__dirname, '.thought-history.json');
const MAX_THOUGHTS = 20; // prevent infinite reasoning loops

class ThoughtProcessor {
  constructor() {
    this.loadHistory();
  }

  loadHistory() {
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
        this.thoughtHistory = data.thoughtHistory || [];
        this.branches = data.branches || {};
      } else {
        this.thoughtHistory = [];
        this.branches = {};
      }
    } catch {
      this.thoughtHistory = [];
      this.branches = {};
    }
  }

  saveHistory() {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify({
      thoughtHistory: this.thoughtHistory,
      branches: this.branches
    }, null, 2));
  }

  resetHistory() {
    this.thoughtHistory = [];
    this.branches = {};
    if (fs.existsSync(HISTORY_FILE)) fs.unlinkSync(HISTORY_FILE);
  }

  validateThought(input) {
    const errors = [];
    // Input sanitization
    if (!input.thought || typeof input.thought !== 'string' || input.thought.trim() === '') {
      errors.push('Invalid thought: must be a non-empty string');
    } else if (input.thought.length > 5000) {
      errors.push('Invalid thought: exceeds 5000 character limit');
    }
    if (!input.thoughtNumber || typeof input.thoughtNumber !== 'number' || input.thoughtNumber < 1) {
      errors.push('Invalid thoughtNumber: must be a positive number');
    }
    if (!input.totalThoughts || typeof input.totalThoughts !== 'number' || input.totalThoughts < 1) {
      errors.push('Invalid totalThoughts: must be a positive number');
    }
    if (typeof input.nextThoughtNeeded !== 'boolean') {
      errors.push('Invalid nextThoughtNeeded: must be a boolean');
    }
    // Max thought limit
    if (this.thoughtHistory.length >= MAX_THOUGHTS) {
      errors.push(`Max thought limit (${MAX_THOUGHTS}) reached. Conclude or reset.`);
    }
    return errors;
  }

  processThought(input) {
    const errors = this.validateThought(input);
    if (errors.length > 0) return { success: false, errors, status: 'failed' };

    if (input.thoughtNumber > input.totalThoughts) input.totalThoughts = input.thoughtNumber;

    const thoughtData = {
      thought: input.thought.trim(),
      thoughtNumber: input.thoughtNumber,
      totalThoughts: input.totalThoughts,
      nextThoughtNeeded: input.nextThoughtNeeded,
      isRevision: input.isRevision,
      revisesThought: input.revisesThought,
      branchFromThought: input.branchFromThought,
      branchId: input.branchId,
      timestamp: new Date().toISOString()
    };

    this.thoughtHistory.push(thoughtData);
    if (thoughtData.branchFromThought && thoughtData.branchId) {
      if (!this.branches[thoughtData.branchId]) this.branches[thoughtData.branchId] = [];
      this.branches[thoughtData.branchId].push(thoughtData);
    }
    this.saveHistory();

    return {
      success: true,
      thoughtNumber: thoughtData.thoughtNumber,
      totalThoughts: thoughtData.totalThoughts,
      nextThoughtNeeded: thoughtData.nextThoughtNeeded,
      branches: Object.keys(this.branches),
      thoughtHistoryLength: this.thoughtHistory.length,
      remainingCapacity: MAX_THOUGHTS - this.thoughtHistory.length
    };
  }

  // Context-efficient summary for handoff to mk:fix
  getSummary() {
    if (this.thoughtHistory.length === 0) return { summary: 'No thoughts recorded.' };
    const last = this.thoughtHistory[this.thoughtHistory.length - 1];
    const revisions = this.thoughtHistory.filter(t => t.isRevision).length;
    const branchCount = Object.keys(this.branches).length;
    return {
      totalThoughts: this.thoughtHistory.length,
      lastThought: last.thought.substring(0, 200),
      revisions,
      branches: branchCount,
      concluded: !last.nextThoughtNeeded
    };
  }

  getHistory() {
    return { thoughts: this.thoughtHistory, branches: this.branches, total: this.thoughtHistory.length };
  }
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const processor = new ThoughtProcessor();

  const parseArgs = (args) => {
    const parsed = {};
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith('--')) {
        const key = arg.slice(2);
        if (['reset', 'history', 'summary'].includes(key)) return { [key]: true };
        const value = args[i + 1];
        if (value && !value.startsWith('--')) {
          if (value === 'true') parsed[key] = true;
          else if (value === 'false') parsed[key] = false;
          else if (!isNaN(value)) parsed[key] = parseFloat(value);
          else parsed[key] = value;
          i++;
        }
      }
    }
    return parsed;
  };

  const input = parseArgs(args);

  if (input.reset) {
    processor.resetHistory();
    console.log(JSON.stringify({ success: true, message: 'History reset' }));
    process.exit(0);
  }
  if (input.history) {
    console.log(JSON.stringify(processor.getHistory(), null, 2));
    process.exit(0);
  }
  if (input.summary) {
    console.log(JSON.stringify(processor.getSummary(), null, 2));
    process.exit(0);
  }

  const result = processor.processThought({
    thought: input.thought,
    thoughtNumber: input.number,
    totalThoughts: input.total,
    nextThoughtNeeded: input.next,
    isRevision: input.revision !== undefined ? true : input.isRevision,
    revisesThought: input.revision,
    branchFromThought: input.branch,
    branchId: input.branchId
  });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
}

module.exports = { ThoughtProcessor };
