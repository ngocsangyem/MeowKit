// memory-filter.cjs — Filter memory entries by domain, staleness, and budget.

'use strict';

const STALENESS_MONTHS = parseInt(process.env.MEOWKIT_MEMORY_STALENESS_MONTHS || '6', 10);
const CRITICAL_CAP = 3000;
const STANDARD_CAP = 800;

function ageInMonths(dateStr) {
  if (!dateStr) return STALENESS_MONTHS + 1;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return STALENESS_MONTHS + 1;
  return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30);
}

function isStale(entry) {
  if (entry.severity === 'critical' || entry.severity === 'security') return false;
  return ageInMonths(entry.date) > STALENESS_MONTHS;
}

function trimEntry(entry) {
  const cap = entry.severity === 'critical' ? CRITICAL_CAP : STANDARD_CAP;
  if (entry.body.length <= cap) return entry.body;
  return entry.body.substring(0, cap) + `\n[TRUNCATED: ${entry.body.length - cap} chars omitted]`;
}

function filterLessons(entries, keywords) {
  const critical = [];
  const domainMatched = [];
  let staleCount = 0;

  for (const entry of entries) {
    if (isStale(entry)) { staleCount++; continue; }

    if (entry.severity === 'critical' || entry.severity === 'security') {
      critical.push(entry);
    } else if (keywords.length > 0) {
      const match = entry.domain.some((d) => keywords.includes(d.toLowerCase()));
      if (match) domainMatched.push(entry);
    } else {
      domainMatched.push(entry);
    }
  }
  return { critical, domainMatched, staleCount };
}

function filterPatterns(patterns, keywords) {
  const now = new Date();
  return patterns.filter((p) => {
    if (p.severity === 'critical' || p.category === 'security') return true;

    const expiresAt = p.expires_at
      ? new Date(p.expires_at)
      : new Date(new Date(p.lastSeen || '2020-01-01').getTime() + 365 * 24 * 60 * 60 * 1000);
    if (expiresAt < now) return false;
    if (p.domain?.length) return p.domain.some((d) => keywords.includes(d.toLowerCase()));
    if (p.applicable_when) {
      const aw = p.applicable_when.toLowerCase();
      return keywords.some((k) => aw.includes(k));
    }
    return false;
  });
}

function applyBudget(critical, domainMatched, patterns, totalBudget) {
  const criticalBudget = Math.floor(totalBudget * 0.6);
  const domainBudget = totalBudget - criticalBudget;
  let output = '';
  let usedCritical = 0;
  let usedDomain = 0;
  let filteredCount = 0;

  for (const entry of critical) {
    const text = trimEntry(entry);
    if (usedCritical + text.length > criticalBudget) { filteredCount++; continue; }
    output += text + '\n\n';
    usedCritical += text.length;
  }

  for (const entry of domainMatched) {
    const text = trimEntry(entry);
    if (usedDomain + text.length > domainBudget) { filteredCount++; continue; }
    output += text + '\n\n';
    usedDomain += text.length;
  }

  for (const p of patterns) {
    const text = `[${p.severity || 'info'}] ${p.pattern}`;
    const remaining = totalBudget - usedCritical - usedDomain;
    if (text.length > remaining) { filteredCount++; continue; }
    output += text + '\n';
    usedDomain += text.length;
  }

  return { output, filteredCount };
}

module.exports = { isStale, trimEntry, filterLessons, filterPatterns, applyBudget, STALENESS_MONTHS };
