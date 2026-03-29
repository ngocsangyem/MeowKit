#!/usr/bin/env node

/**
 * Sequential Thinking Thought Formatter
 * Formats thoughts for display: box, simple, markdown, or JSON.
 *
 * Usage:
 *   node format-thought.js --thought "Analysis" --number 1 --total 5
 *   node format-thought.js --thought "Revision" --number 2 --total 5 --revision 1
 *   node format-thought.js --thought "Branch" --number 3 --total 5 --branch 2 --branchId "a"
 *   node format-thought.js --thought "Analysis" --number 1 --total 5 --format json
 *
 * Improvements over CK version:
 *   - Added JSON format for machine-readable output
 *   - Removed emoji (wastes tokens in LLM context)
 *
 * Source: claudekit-engineer/sequential-thinking (MIT, improved)
 */

class ThoughtFormatter {
  static format(data) {
    const { thoughtNumber, totalThoughts, thought, isRevision, revisesThought, branchFromThought, branchId } = data;

    let prefix = 'Thought';
    let context = '';
    if (isRevision && revisesThought) {
      prefix = 'REVISION';
      context = ` (revising thought ${revisesThought})`;
    } else if (branchFromThought) {
      prefix = 'BRANCH';
      context = branchId ? ` (from thought ${branchFromThought}, ID: ${branchId})` : ` (from thought ${branchFromThought})`;
    }

    const header = `${prefix} ${thoughtNumber}/${totalThoughts}${context}`;
    const maxLen = Math.max(header.length, 60);
    const border = '-'.repeat(maxLen + 4);
    const wrapped = this.wrapText(thought, maxLen);
    const lines = wrapped.map(l => `| ${l.padEnd(maxLen + 2)} |`).join('\n');

    return `\n+${border}+\n| ${header.padEnd(maxLen + 2)} |\n+${border}+\n${lines}\n+${border}+`;
  }

  static wrapText(text, maxWidth) {
    if (text.length <= maxWidth) return [text];
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
      if ((current + ' ' + word).trim().length <= maxWidth) {
        current = current ? current + ' ' + word : word;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  static formatSimple(data) {
    const { thoughtNumber, totalThoughts, thought, isRevision, revisesThought, branchFromThought, branchId } = data;
    let marker = '';
    if (isRevision && revisesThought) marker = ` [REVISION of Thought ${revisesThought}]`;
    else if (branchFromThought) marker = branchId ? ` [BRANCH ${branchId.toUpperCase()} from Thought ${branchFromThought}]` : ` [BRANCH from Thought ${branchFromThought}]`;
    return `Thought ${thoughtNumber}/${totalThoughts}${marker}: ${thought}`;
  }

  static formatMarkdown(data) {
    const { thoughtNumber, totalThoughts, thought, isRevision, revisesThought, branchFromThought, branchId } = data;
    let marker = '';
    if (isRevision && revisesThought) marker = ` **[REVISION of Thought ${revisesThought}]**`;
    else if (branchFromThought) marker = branchId ? ` **[BRANCH ${branchId.toUpperCase()} from Thought ${branchFromThought}]**` : ` **[BRANCH from Thought ${branchFromThought}]**`;
    return `**Thought ${thoughtNumber}/${totalThoughts}**${marker}\n\n${thought}\n`;
  }

  static formatJson(data) {
    return JSON.stringify({
      thoughtNumber: data.thoughtNumber,
      totalThoughts: data.totalThoughts,
      thought: data.thought,
      type: data.isRevision ? 'revision' : data.branchFromThought ? 'branch' : 'regular',
      revisesThought: data.revisesThought || null,
      branchFromThought: data.branchFromThought || null,
      branchId: data.branchId || null
    }, null, 2);
  }
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const parseArgs = (args) => {
    const parsed = {};
    for (let i = 0; i < args.length; i++) {
      if (args[i].startsWith('--')) {
        const key = args[i].slice(2);
        const val = args[i + 1];
        if (val && !val.startsWith('--')) {
          if (val === 'true') parsed[key] = true;
          else if (val === 'false') parsed[key] = false;
          else if (!isNaN(val)) parsed[key] = parseFloat(val);
          else parsed[key] = val;
          i++;
        }
      }
    }
    return parsed;
  };

  const input = parseArgs(args);
  const data = {
    thought: input.thought || 'No thought provided',
    thoughtNumber: input.number || 1,
    totalThoughts: input.total || 1,
    isRevision: input.revision !== undefined,
    revisesThought: input.revision,
    branchFromThought: input.branch,
    branchId: input.branchId
  };

  const fmt = input.format || 'box';
  switch (fmt) {
    case 'simple': console.log(ThoughtFormatter.formatSimple(data)); break;
    case 'markdown': console.log(ThoughtFormatter.formatMarkdown(data)); break;
    case 'json': console.log(ThoughtFormatter.formatJson(data)); break;
    default: console.log(ThoughtFormatter.format(data));
  }
}

module.exports = { ThoughtFormatter };
