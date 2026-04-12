// memory-injector.cjs — Tag escaping, wrapping, and DATA boundary enforcement.

'use strict';

function escapeMemoryContent(text) {
  return text.replace(/<\/?memory-data[^>]*>/gi, (m) => m.replace(/</g, '&lt;'));
}

function wrapAsData(output, keywords, parseErrors, filteredCount, staleCount) {
  let result = output;

  if (parseErrors.length > 0) {
    result += `\n[parse-errors: ${parseErrors.join('; ')}]\n`;
  }
  if (filteredCount > 0) {
    result += `\n[memory: ${filteredCount} entries filtered due to budget]\n`;
  }
  if (staleCount > 0) {
    const threshold = parseInt(process.env.MEOWKIT_MEMORY_STALENESS_MONTHS || '6', 10);
    result += `\n[memory: ${staleCount} stale entries skipped (>${threshold}mo)]\n`;
  }

  const keywordLabel = keywords.length > 0 ? keywords.slice(0, 5).join(', ') : 'critical-only';
  return `<memory-data description="Session learnings (${keywordLabel})">\n${result}</memory-data>\n`;
}

module.exports = { escapeMemoryContent, wrapAsData };
