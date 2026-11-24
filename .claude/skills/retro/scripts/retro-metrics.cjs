#!/usr/bin/env node
// Computes retrospective metrics from git history and prints one JSON object.
// Usage: node retro-metrics.cjs [--since <date or "N hours ago">] [--until <date>] [--ref <branch>]
//                               [--repo <dir>] [--write-snapshot <dir>]
// Commit text is treated as data: it is only counted and echoed, never executed.

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const SESSION_GAP_MIN = 45;
const TEST_PATH = /(^|\/)(tests?|spec|__tests__)\/|\.(test|spec)\.|_(test|spec)\./;

function parseArgs(argv) {
  const out = { since: "7 days ago", until: null, ref: "HEAD", repo: process.cwd(), snapshotDir: null };
  for (let i = 0; i < argv.length; i += 1) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if (flag === "--since") out.since = value;
    else if (flag === "--until") out.until = value;
    else if (flag === "--ref") out.ref = value;
    else if (flag === "--repo") out.repo = value;
    else if (flag === "--write-snapshot") out.snapshotDir = value;
    else continue;
    i += 1;
  }
  return out;
}

function readCommits({ since, until, ref, repo }) {
  const untilArgs = until ? [`--until=${until}`] : [];
  const raw = execFileSync(
    "git",
    ["log", ref, `--since=${since}`, ...untilArgs, "--no-merges", "--format=@@%H|%aN|%at|%s", "--numstat"],
    { cwd: repo, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );
  const commits = [];
  for (const block of raw.split("@@").slice(1)) {
    const [head, ...rest] = block.split("\n");
    const [hash, author, ts, ...subject] = head.split("|");
    const files = [];
    for (const line of rest) {
      const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line);
      if (m) files.push({ ins: m[1] === "-" ? 0 : +m[1], del: m[2] === "-" ? 0 : +m[2], file: m[3] });
    }
    const loc = files.reduce((n, f) => n + f.ins + f.del, 0);
    commits.push({ hash, author, ts: +ts, subject: subject.join("|"), files, loc });
  }
  return commits.sort((a, b) => a.ts - b.ts);
}

const topDir = (file) => (file.includes("/") ? `${file.split("/")[0]}/` : "(root)");
const dayKey = (ts) => {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const countBy = (items, key) => items.reduce((m, i) => ((m[key(i)] = (m[key(i)] || 0) + 1), m), {});
const top = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1])[0];

function sessions(commits) {
  const out = [];
  for (const c of commits) {
    const last = out[out.length - 1];
    if (last && c.ts - last.end <= SESSION_GAP_MIN * 60) {
      last.end = c.ts;
      last.commits += 1;
    } else out.push({ start: c.ts, end: c.ts, commits: 1 });
  }
  return out.map((s) => ({ ...s, minutes: Math.round((s.end - s.start) / 60) }));
}

function streaks(days) {
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of sorted) {
    const t = Date.parse(`${d}T12:00:00Z`);
    run = prev !== null && Math.round((t - prev) / 86400000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return { longest: best, ending_at_last_commit_day: run };
}

function compute(commits) {
  const all = commits.flatMap((c) => c.files);
  const ins = all.reduce((n, f) => n + f.ins, 0);
  const del = all.reduce((n, f) => n + f.del, 0);
  const testIns = all.filter((f) => TEST_PATH.test(f.file)).reduce((n, f) => n + f.ins, 0);
  const sess = sessions(commits);
  const activeMin = sess.reduce((n, s) => n + s.minutes, 0);
  const byAuthor = {};
  for (const c of commits) {
    const a = (byAuthor[c.author] ||= { commits: 0, insertions: 0, deletions: 0, dirs: {} });
    a.commits += 1;
    for (const f of c.files) {
      a.insertions += f.ins;
      a.deletions += f.del;
      a.dirs[topDir(f.file)] = (a.dirs[topDir(f.file)] || 0) + 1;
    }
  }
  const dirCommits = {};
  for (const c of commits) for (const d of new Set(c.files.map((f) => topDir(f.file)))) dirCommits[d] = (dirCommits[d] || 0) + 1;
  const focus = top(dirCommits);
  const hotspots = Object.entries(countBy(all, (f) => f.file)).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const biggest = [...commits].sort((a, b) => b.loc - a.loc)[0];
  const days = new Set(commits.map((c) => dayKey(c.ts)));
  const bucket = (n) => (n < 100 ? "small" : n < 500 ? "medium" : n < 1500 ? "large" : "xl");
  return {
    commits: commits.length,
    contributors: Object.keys(byAuthor).length,
    pr_numbers: [...new Set(commits.flatMap((c) => c.subject.match(/#\d+/g) || []))],
    insertions: ins,
    deletions: del,
    net_loc: ins - del,
    test_insertions: testIns,
    test_ratio_pct: ins ? Math.round((testIns / ins) * 100) : 0,
    active_days: days.size,
    streak_days: streaks(days),
    authors: Object.entries(byAuthor)
      .map(([name, a]) => ({ name, commits: a.commits, insertions: a.insertions, deletions: a.deletions, top_area: (top(a.dirs) || ["-"])[0] }))
      .sort((a, b) => b.commits - a.commits),
    sessions: {
      count: sess.length,
      deep_50_plus_min: sess.filter((s) => s.minutes >= 50).length,
      medium_20_to_50_min: sess.filter((s) => s.minutes >= 20 && s.minutes < 50).length,
      micro_under_20_min: sess.filter((s) => s.minutes < 20).length,
      active_minutes: activeMin,
      avg_minutes: sess.length ? Math.round(activeMin / sess.length) : 0,
      loc_per_active_hour: activeMin ? Math.round((ins + del) / (activeMin / 60)) : null,
    },
    hourly_commits: countBy(commits, (c) => String(new Date(c.ts * 1000).getHours()).padStart(2, "0")),
    commit_types: countBy(commits, (c) => (/^(\w+)(\([^)]*\))?!?:/.exec(c.subject) || [])[1] || "other"),
    hotspots: hotspots.map(([file, changes]) => ({ file, changes, churn: changes >= 5 })),
    pr_size_buckets: countBy(commits, (c) => bucket(c.loc)),
    focus_score: focus ? { pct: Math.round((focus[1] / commits.length) * 100), area: focus[0] } : null,
    ship_of_the_period: biggest ? { subject: biggest.subject, loc: biggest.loc, hash: biggest.hash.slice(0, 8) } : null,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const commits = readCommits(args);
  const result = { window: { since: args.since, until: args.until, ref: args.ref }, ...(commits.length ? compute(commits) : { commits: 0 }) };
  if (args.snapshotDir && commits.length) {
    fs.mkdirSync(args.snapshotDir, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const n = fs.readdirSync(args.snapshotDir).filter((f) => f.startsWith(date)).length + 1;
    const file = path.join(args.snapshotDir, `${date}-${n}.json`);
    fs.writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`);
    result.snapshot = file;
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

try {
  main();
} catch (err) {
  process.stderr.write(`retro-metrics: ${err.message}\n`);
  process.exit(1);
}
