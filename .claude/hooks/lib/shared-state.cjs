// shared-state.cjs — Persistent JSON state for cross-handler data sharing.
//
// One JSON file per name in the session-marker class, written atomically
// (tmp+rename). The directory comes from the one path resolver rather than being
// joined here: a hand-joined project-root path is what used to drop these files
// beside a user's source tree.

const fs = require('fs');
const path = require('path');

const { sessionStateDir, sessionStateFile } = require('./meowkit-paths.cjs');

const DIR = sessionStateDir();

module.exports = {
  load(name) {
    try {
      return JSON.parse(fs.readFileSync(sessionStateFile(`${name}.json`), 'utf8'));
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
