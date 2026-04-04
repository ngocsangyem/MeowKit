#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

// ANSI colors
const c = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', magenta: '\x1b[35m', gray: '\x1b[90m'
};

// Read stdin with 2s timeout (prevents orphan processes)
function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const timer = setTimeout(() => reject(new Error('stdin timeout')), 2000);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => chunks.push(chunk));
    process.stdin.on('end', () => { clearTimeout(timer); resolve(chunks.join('')); });
    process.stdin.on('error', err => { clearTimeout(timer); reject(err); });
  });
}

// Parse stdin JSON with safe defaults
function parseInput(raw) {
  const d = JSON.parse(raw);
  return {
    model: d?.model?.display_name || 'Claude',
    cwd: d?.workspace?.current_dir || d?.cwd || process.cwd(),
    projectDir: d?.workspace?.project_dir || process.cwd(),
    sessionId: d?.session_id || '',
    ctxSize: d?.context_window?.context_window_size || 0,
    ctxUsed: d?.context_window?.used_percentage || 0,
    ctxInput: d?.context_window?.current_usage?.input_tokens || 0,
    ctxCacheCreate: d?.context_window?.current_usage?.cache_creation_input_tokens || 0,
    ctxCacheRead: d?.context_window?.current_usage?.cache_read_input_tokens || 0,
    totalIn: d?.context_window?.total_input_tokens || 0,
    totalOut: d?.context_window?.total_output_tokens || 0,
    costUsd: d?.cost?.total_cost_usd || 0,
    linesAdded: d?.cost?.total_lines_added || 0,
    linesRemoved: d?.cost?.total_lines_removed || 0,
    fiveHourPct: d?.rate_limits?.five_hour?.used_percentage ?? null,
    fiveHourReset: d?.rate_limits?.five_hour?.resets_at || null,
    weekPct: d?.rate_limits?.seven_day?.used_percentage ?? null,
    weekReset: d?.rate_limits?.seven_day?.resets_at || null,
  };
}

function fmtTokens(n) { if (!n || n <= 0) return '0'; if (n >= 1e6) return (n/1e6).toFixed(1)+'M'; if (n >= 1e3) return Math.round(n/1e3)+'k'; return String(n); }
function fmtCountdown(resetAt) {
  if (!resetAt) return '';
  // resets_at is epoch SECONDS per Claude Code docs (e.g. 1738425600)
  const resetMs = typeof resetAt === 'number' ? (resetAt < 1e12 ? resetAt * 1000 : resetAt) : new Date(resetAt).getTime();
  const ms = resetMs - Date.now();
  if (ms <= 0) return '';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d${h > 0 ? h + 'h' : ''}`;
  return h > 0 ? `${h}h${m > 0 ? m + 'm' : ''}` : `${m}m`;
}
function coloredBar(pct, width = 10) {
  const p = Math.max(0, Math.min(100, pct || 0)), filled = Math.round((p / 100) * width);
  const clr = p > 75 ? c.red : p > 50 ? c.yellow : c.green;
  return clr + '\u25CF'.repeat(filled) + c.gray + '\u25CB'.repeat(width - filled) + c.reset;
}
function safeCwd(cwd) { return cwd.replace(/[/\\:.\s]/g, '_'); }

function getGitInfo(cwd) {
  const key = safeCwd(cwd);
  const cacheFile = path.join(os.tmpdir(), `mk-git-${key}.json`);
  const lockFile = cacheFile + '.lock';
  const stale = { branch: '', unstaged: 0, staged: 0 };
  // Read cache
  try {
    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    if (Date.now() - cached.ts < 5000) return cached.data;
    stale.branch = cached.data?.branch || '';
    stale.unstaged = cached.data?.unstaged || 0;
    stale.staged = cached.data?.staged || 0;
  } catch {}
  // Acquire lock (wx = exclusive create — fails if lock exists, no TOCTOU)
  try {
    fs.writeFileSync(lockFile, String(process.pid), { flag: 'wx' });
  } catch { return stale; } // locked by another process
  // Single git command: `status -b --porcelain` gives branch + file status
  try {
    const out = execFileSync('git', ['status', '-b', '--porcelain'], { cwd, timeout: 500, encoding: 'utf-8' });
    const lines = out.split('\n');
    let branch = '', unstaged = 0, staged = 0;
    for (const line of lines) {
      if (line.startsWith('## ')) { branch = line.slice(3).split('...')[0]; continue; }
      if (!line) continue;
      if (line[0] !== ' ' && line[0] !== '?') staged++;
      if (line[1] === 'M' || line[1] === 'D') unstaged++;
      if (line[0] === '?') unstaged++;
    }
    const data = { branch, unstaged, staged };
    fs.writeFileSync(cacheFile, JSON.stringify({ ts: Date.now(), data }));
    return data;
  } catch { return stale; }
  finally { try { fs.unlinkSync(lockFile); } catch {} }
}

function expandHome(p) {
  const h = os.homedir();
  return p.startsWith(h) ? '~' + p.slice(h.length) : p;
}

function detectTier(model) {
  const m = (model || '').toLowerCase();
  if (m.includes('opus')) return 'COMPLEX';
  if (m.includes('haiku')) return 'TRIVIAL';
  return 'STANDARD';
}

// --- LINE RENDERERS ---

function renderLine1(ctx) {
  const parts = [];
  // Model + tier
  const tier = detectTier(ctx.model);
  const tierColor = tier === 'COMPLEX' ? c.red : tier === 'TRIVIAL' ? c.green : c.yellow;
  parts.push(`\uD83D\uDC31 ${c.cyan}${ctx.model}${c.reset} ${tierColor}${tier}${c.reset}`);
  // Git
  const git = getGitInfo(ctx.cwd);
  if (git.branch) {
    let gitPart = `\uD83C\uDF3F ${c.magenta}${git.branch}${c.reset}`;
    const indicators = [];
    if (git.unstaged > 0) indicators.push(`${git.unstaged}m`);
    if (git.staged > 0) indicators.push(`+${git.staged}s`);
    if (indicators.length) gitPart += ` ${c.yellow}(${indicators.join(', ')})${c.reset}`;
    parts.push(gitPart);
  }
  // Lines changed
  if (ctx.linesAdded > 0 || ctx.linesRemoved > 0) {
    parts.push(`\uD83D\uDCDD ${c.green}+${ctx.linesAdded}${c.reset} ${c.red}-${ctx.linesRemoved}${c.reset}`);
  }
  // Cost
  const cost = parseFloat(ctx.costUsd);
  if (cost > 0) parts.push(`${c.dim}$${cost.toFixed(2)}${c.reset}`);
  return parts.join(` ${c.dim}|${c.reset} `);
}

function renderLine2(ctx) {
  // Context window usage bar — uses pre-computed ctxUsedTokens/ctxPct from main
  const used = ctx.ctxUsedTokens;
  const pct = ctx.ctxPct;
  const bar = coloredBar(pct);
  let line = `${bar} ${c.bold}${fmtTokens(used)}/${fmtTokens(ctx.ctxSize)}${c.reset} ${c.dim}(${pct}%)${c.reset}`;
  // Warn when context is getting full
  if (pct >= 80) line += ` ${c.red}${c.bold}← /clear recommended${c.reset}`;
  else if (pct >= 60) line += ` ${c.yellow}${c.dim}← consider /clear${c.reset}`;
  return line;
}

// Plan info (file-based cache 10s TTL)
function readPlanInfo(sessionId, projectDir) {
  if (!sessionId || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) return null;
  const cacheFile = path.join(os.tmpdir(), `mk-plan-${sessionId}.json`);
  try {
    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    if (Date.now() - cached.ts < 10000) return cached.data;
  } catch {}

  let activePlan = '';
  const sessionFile = path.join(os.tmpdir(), `ck-session-${sessionId}.json`);
  try {
    activePlan = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'))?.activePlan?.trim() || '';
  } catch { /* session file missing or corrupt — skip plan display */ }
  if (activePlan && !path.resolve(activePlan).startsWith(path.resolve(projectDir))) activePlan = '';

  const slugMatch = activePlan.match(/plans\/\d+-\d+-(.+?)(?:\/|$)/);
  const slug = slugMatch ? slugMatch[1] : '';
  let phase = '';
  if (slug && activePlan) {
    try {
      const planMd = fs.readFileSync(path.join(activePlan, 'plan.md'), 'utf-8');
      for (const line of planMd.split('\n')) {
        const m = line.match(/\|\s*(\d+)\s*\|.*?\|\s*(Pending|In Progress)/i);
        if (m) { phase = `phase-${m[1].padStart(2, '0')}`; break; }
      }
    } catch {}
  }

  let nextPlan = '';
  try {
    const plansDir = path.join(projectDir, 'plans');
    if (fs.existsSync(plansDir)) {
      const dirs = fs.readdirSync(plansDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && /^\d+-\d+-.+/.test(d.name)).map(d => d.name).sort();
      const activeIdx = slug ? dirs.findIndex(d => d.includes(slug)) : -1;
      for (let i = activeIdx + 1; i < dirs.length; i++) {
        try {
          const pm = fs.readFileSync(path.join(plansDir, dirs[i], 'plan.md'), 'utf-8');
          if (/status:\s*(pending|active)/i.test(pm)) {
            const nm = dirs[i].match(/\d+-\d+-(.+)/);
            nextPlan = nm ? nm[1] : dirs[i]; break;
          }
        } catch {}
      }
    }
  } catch {}

  const result = { slug, phase, nextPlan };
  try { fs.writeFileSync(cacheFile, JSON.stringify({ ts: Date.now(), data: result })); } catch {}
  return result;
}

function renderLine3(planInfo) {
  if (!planInfo?.slug) return `${c.dim}\uD83D\uDCCB no active plan${c.reset}`;
  let line = `\uD83D\uDCCB ${c.cyan}${planInfo.slug}${c.reset}`;
  if (planInfo.phase) line += ` ${c.dim}${planInfo.phase}${c.reset}`;
  if (planInfo.nextPlan) line += ` ${c.dim}| next: ${planInfo.nextPlan}${c.reset}`;
  return line;
}

// Rate limits line — uses stdin data directly (per Claude Code docs, rate_limits
// is provided for Pro/Max subscribers after first API response)
function renderLine4Quota(ctx) {
  if (ctx.fiveHourPct == null && ctx.weekPct == null) return null;
  const parts = [];
  if (ctx.fiveHourPct != null) {
    let s = `${c.bold}5h ${Math.round(ctx.fiveHourPct)}%${c.reset}`;
    const cd = fmtCountdown(ctx.fiveHourReset);
    if (cd) s += ` ${c.dim}(${cd})${c.reset}`;
    parts.push(s);
  }
  if (ctx.weekPct != null) {
    let s = `${c.bold}Weekly ${Math.round(ctx.weekPct)}%${c.reset}`;
    const cd = fmtCountdown(ctx.weekReset);
    if (cd) s += ` ${c.dim}(${cd})${c.reset}`;
    parts.push(s);
  }
  return `\u231B ${parts.join('  ')}`;
}

function renderLine5(ctx) {
  const parts = [];
  parts.push(`\uD83D\uDD24 ${c.bold}ctx${c.reset} ${fmtTokens(ctx.ctxUsedTokens)}/${fmtTokens(ctx.ctxSize)} (${ctx.ctxPct}%)`);
  if (ctx.totalIn > 0 || ctx.totalOut > 0) {
    parts.push(`${c.dim}session ${fmtTokens(ctx.totalIn)} in + ${fmtTokens(ctx.totalOut)} out${c.reset}`);
  }
  return parts.join(` ${c.dim}|${c.reset} `);
}

// --- MAIN ---
async function main() {
  try {
    const raw = await readStdin();
    if (!raw.trim()) { console.log('\uD83D\uDC31 MeowKit'); return; }
    const ctx = parseInput(raw);
    // Pre-compute context values once (used by line 2 + line 5)
    ctx.ctxUsedTokens = ctx.ctxInput + ctx.ctxCacheCreate + ctx.ctxCacheRead;
    ctx.ctxPct = ctx.ctxSize > 0 ? Math.min(100, Math.round((ctx.ctxUsedTokens / ctx.ctxSize) * 100)) : 0;
    console.log(renderLine1(ctx));
    console.log(renderLine2(ctx));
    const planInfo = readPlanInfo(ctx.sessionId, ctx.projectDir);
    console.log(renderLine3(planInfo));
    const quotaLine = renderLine4Quota(ctx);
    if (quotaLine) console.log(quotaLine);
    console.log(renderLine5(ctx));
  } catch {
    console.log(`\uD83D\uDC31 ${expandHome(process.cwd())}`);
  }
}

main().catch(() => { console.log('\uD83D\uDC31 MeowKit'); process.exit(0); });
