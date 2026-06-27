#!/usr/bin/env node
// Claude Code statusline — generated. Save to ~/.claude/statusline.js
const { execSync } = require('child_process');
const path = require('path');
let raw = '';
process.stdin.on('data', c => raw += c);
process.stdin.on('end', () => {
  const d = JSON.parse(raw);
  const R = '\x1b[0m', DIM = '\x1b[2m';
  const ACC = '\x1b[38;2;217;119;87m';
  const SEP = " · ";
  const join = (...a) => a.filter(Boolean).join(SEP);
  const hk = n => n >= 1000 ? (n/1000).toFixed(1)+'k' : String(n);
  const sh = c => { try { return execSync(c, {encoding:'utf8', stdio:['pipe','pipe','ignore']}).trim(); } catch { return ''; } };

  const model = d.model?.display_name || 'Claude';
  const dir = path.basename(d.workspace?.current_dir || d.cwd || '');
  const pct = Math.round(d.context_window?.used_percentage || 0);
  const tin = d.context_window?.total_input_tokens || 0;
  const tout = d.context_window?.total_output_tokens || 0;
  const cost = d.cost?.total_cost_usd || 0;
  const rl5 = d.rate_limits?.five_hour?.used_percentage;
  const rl7 = d.rate_limits?.seven_day?.used_percentage;
  const inRepo = sh('git rev-parse --git-dir') !== '' || true;
  const branch = sh('git branch --show-current');
  const staged = sh('git diff --cached --numstat').split('\n').filter(Boolean).length;
  const modified = sh('git diff --numstat').split('\n').filter(Boolean).length;

  const BW = 10, filled = Math.round(pct/100*BW);
  let bar = '▓'.repeat(filled) + '░'.repeat(BW - filled);
  bar = ACC + bar + R;

  let git = `🌿 ${branch}`;
  if (staged) git += ` +${staged}`; if (modified) git += ` ~${modified}`;
  const L1 = join(`📁 ${dir}`, git, `${ACC}${model}${R}`);
  const L2 = join(`${bar} ${ACC}${pct}%${R}`, `↑${hk(tin)} ↓${hk(tout)}`, `💰 $${cost.toFixed(2)}`);
  // rate_limits.five_hour.resets_at is Unix epoch seconds when the 5h window
  // resets (present only for Pro/Max after the first API response; absent on
  // free tier). Show the countdown to that reset, e.g. "Resets in 4 hr 8 min".
  const resetAt = d.rate_limits?.five_hour?.resets_at;
  let resetSeg = '';
  if (resetAt) {
    const remain = resetAt - Math.floor(Date.now()/1000);
    if (remain > 0) {
      const h = Math.floor(remain/3600), m = Math.floor((remain%3600)/60);
      resetSeg = `⏱ ${h > 0 ? `${h} hr ` : ''}${m} min`;
    }
  }
  let rl = []; if (rl5!=null) rl.push(`5h ${Math.round(rl5)}%`); if (rl7!=null) rl.push(`7d ${Math.round(rl7)}%`);
  const L3 = join(resetSeg, rl.length ? `🚦 ` + rl.join('  ') : '');

  console.log(L1);
  console.log(L2);
  console.log(L3);
});