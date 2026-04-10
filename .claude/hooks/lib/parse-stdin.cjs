// parse-stdin.cjs — Read all stdin and parse as JSON.
// Returns a promise that resolves to the parsed object.
// Normalizes file_path in tool_input if present.

const path = require('path');

function normalizeFilePath(filePath, cwd) {
  if (!filePath) return filePath;
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(cwd || process.cwd(), filePath);
}

function parseStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => {
      try {
        const parsed = JSON.parse(data || '{}');
        // Normalize file_path if present
        if (parsed.tool_input && parsed.tool_input.file_path) {
          parsed.tool_input.file_path = normalizeFilePath(
            parsed.tool_input.file_path,
            parsed.cwd
          );
        }
        resolve(parsed);
      } catch {
        resolve({});
      }
    });
    // Handle closed stdin (no data)
    process.stdin.on('error', () => resolve({}));
  });
}

module.exports = { parseStdin, normalizeFilePath };
