// shared-state.cjs — Persistent JSON state for cross-handler data sharing.
// Files stored in session-state/*.json with atomic writes (tmp+rename).

const fs = require('fs');
const path = require('path');

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const DIR = path.join(ROOT, 'session-state');

module.exports = {
  load(name) {
    try {
      return JSON.parse(fs.readFileSync(path.join(DIR, `${name}.json`), 'utf8'));
    } catch {
      return null;
    }
  },

  save(name, data) {
    fs.mkdirSync(DIR, { recursive: true });
    const filePath = path.join(DIR, `${name}.json`);
    const tmp = filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, filePath);
  },
};
