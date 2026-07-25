#!/usr/bin/env node

/**
 * Markdown Reader Server
 * Background HTTP server rendering markdown files with a calm, book-like UI.
 * Binds exclusively to 127.0.0.1 — no LAN exposure of served files.
 *
 * Usage:
 *   node server.cjs --file ./plan.md [--port 3456] [--no-open] [--stop]
 *   node server.cjs --dir ./plans [--port 3456]
 *
 * Options:
 *   --file <path>   Markdown file to view
 *   --dir <path>    Directory to browse
 *   --port <number> Server port (default: 3456; auto-increments if busy)
 *   --no-open       Suppress auto-open browser (default: opens)
 *   --stop          Stop all running server instances
 *   --background    Spawn detached child process and exit (legacy mode)
 *   --foreground    Run in-process (for background task runners)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');

const { findAvailablePort, DEFAULT_PORT } = require('./lib/port-finder.cjs');
const { writePidFile, stopAllServers, setupShutdownHandlers, findRunningInstances } = require('./lib/process-mgr.cjs');
const { createHttpServer } = require('./lib/http-server.cjs');
const { renderMarkdownFile, renderTOCHtml } = require('./lib/markdown-renderer.cjs');
const { generateNavSidebar, generateNavFooter, detectPlan, getNavigationContext } = require('./lib/plan-navigator.cjs');

// Server always binds localhost only — served files must not be LAN-reachable.
const BIND_HOST = '127.0.0.1';

/**
 * Parse command line arguments.
 */
function parseArgs(argv) {
  const args = {
    file: null,
    dir: null,
    port: DEFAULT_PORT,
    open: true,
    stop: false,
    background: false,
    foreground: false,
    isChild: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--file' && argv[i + 1]) {
      args.file = argv[++i];
    } else if (arg === '--dir' && argv[i + 1]) {
      args.dir = argv[++i];
    } else if (arg === '--port' && argv[i + 1]) {
      args.port = parseInt(argv[++i], 10);
    } else if (arg === '--open') {
      args.open = true;
    } else if (arg === '--no-open') {
      args.open = false;
    } else if (arg === '--stop') {
      args.stop = true;
    } else if (arg === '--background') {
      args.background = true;
    } else if (arg === '--foreground') {
      args.foreground = true;
    } else if (arg === '--child') {
      args.isChild = true;
    } else if (!arg.startsWith('--') && !args.file && !args.dir) {
      args.file = arg;
    }
  }

  return args;
}

/**
 * Resolve input path to {type, path} — no smart detection, simple stat.
 */
function resolveInput(input, cwd) {
  if (!input) return { type: null, path: null };
  const resolved = path.isAbsolute(input) ? input : path.resolve(cwd, input);
  if (!fs.existsSync(resolved)) return { type: null, path: null };
  const stats = fs.statSync(resolved);
  if (stats.isFile()) return { type: 'file', path: resolved };
  if (stats.isDirectory()) return { type: 'directory', path: resolved };
  return { type: null, path: null };
}

/**
 * Open browser with URL on the current platform.
 */
function openBrowser(url) {
  let cmd;
  if (process.platform === 'darwin') cmd = `open "${url}"`;
  else if (process.platform === 'win32') cmd = `start "" "${url}"`;
  else cmd = `xdg-open "${url}"`;
  try { execSync(cmd, { stdio: 'ignore' }); } catch { /* ignore */ }
}

/**
 * Render the full viewer page from a markdown file.
 */
function generateFullPage(filePath, assetsDir) {
  const { html, toc, frontmatter, title } = renderMarkdownFile(filePath);
  const tocHtml = renderTOCHtml(toc);
  const navSidebar = generateNavSidebar(filePath);
  const navFooter = generateNavFooter(filePath);
  const planInfo = detectPlan(filePath);
  const navContext = getNavigationContext(filePath);

  const templatePath = path.join(assetsDir, 'template.html');
  let template = fs.readFileSync(templatePath, 'utf8');

  const parentDir = path.dirname(filePath);
  const backButton = `
    <a href="/browse?dir=${encodeURIComponent(parentDir)}" class="icon-btn back-btn" title="Back to folder">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    </a>`;

  let headerNav = '';
  if (navContext.prev || navContext.next) {
    const prevBtn = navContext.prev && fs.existsSync(navContext.prev.file)
      ? `<a href="/view?file=${encodeURIComponent(navContext.prev.file)}" class="header-nav-btn prev" title="${navContext.prev.name}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
          <span>Prev</span>
        </a>` : '';
    const nextBtn = navContext.next && fs.existsSync(navContext.next.file)
      ? `<a href="/view?file=${encodeURIComponent(navContext.next.file)}" class="header-nav-btn next" title="${navContext.next.name}">
          <span>Next</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
        </a>` : '';
    headerNav = `<div class="header-nav">${prevBtn}${nextBtn}</div>`;
  }

  template = template
    .replace(/\{\{title\}\}/g, title)
    .replace('{{toc}}', tocHtml)
    .replace('{{nav-sidebar}}', navSidebar)
    .replace('{{nav-footer}}', navFooter)
    .replace('{{content}}', html)
    .replace('{{has-plan}}', planInfo.isPlan ? 'has-plan' : '')
    .replace('{{frontmatter}}', JSON.stringify(frontmatter || {}))
    .replace('{{back-button}}', backButton)
    .replace('{{header-nav}}', headerNav);

  return template;
}

/**
 * Build the local URL for the current view.
 */
function buildUrl(port, type, filePath) {
  const base = `http://localhost:${port}`;
  if (type === 'file') return `${base}/view?file=${encodeURIComponent(filePath)}`;
  if (type === 'directory') return `${base}/browse?dir=${encodeURIComponent(filePath)}`;
  return base;
}

/**
 * Main entry point.
 */
async function main() {
  const args = parseArgs(process.argv);
  const cwd = process.cwd();
  const assetsDir = path.join(__dirname, '..', 'assets');

  if (args.stop) {
    const instances = findRunningInstances();
    if (instances.length === 0) { console.log('No server running to stop'); process.exit(0); }
    const stopped = stopAllServers();
    console.log(`Stopped ${stopped} server(s)`);
    process.exit(0);
  }

  const input = args.dir || args.file;
  if (!input) {
    console.error('Error: --file or --dir argument required');
    console.error('Usage:');
    console.error('  node server.cjs --file <path.md> [--port 3456] [--open]');
    console.error('  node server.cjs --dir <path> [--port 3456]');
    process.exit(1);
  }

  let resolved = resolveInput(input, cwd);
  if (args.dir && resolved.type === null) {
    const dirPath = path.isAbsolute(args.dir) ? args.dir : path.resolve(cwd, args.dir);
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      resolved = { type: 'directory', path: dirPath };
    }
  }
  if (resolved.type === null) {
    console.error(`Error: Invalid path: ${input}`);
    process.exit(1);
  }

  // Background mode — spawn detached child and exit (legacy / manual-run mode)
  if (args.background && !args.foreground && !args.isChild) {
    const childArgs = ['--port', String(args.port), '--child'];
    if (resolved.type === 'file') childArgs.unshift('--file', resolved.path);
    else childArgs.unshift('--dir', resolved.path);
    if (args.open) childArgs.push('--open');

    const child = spawn(process.execPath, [__filename, ...childArgs], {
      detached: true,
      stdio: 'ignore',
      cwd,
    });
    child.unref();

    await new Promise(r => setTimeout(r, 500));
    const instances = findRunningInstances();
    const instance = instances.find(i => i.port >= args.port);
    const port = instance ? instance.port : args.port;
    const url = buildUrl(port, resolved.type, resolved.path);
    console.log(JSON.stringify({ success: true, url, path: resolved.path, port, mode: resolved.type }));
    process.exit(0);
  }

  const port = await findAvailablePort(args.port);
  if (port !== args.port) console.error(`Port ${args.port} in use, using ${port}`);

  const assetsResolvedDir = assetsDir;
  const allowedDirs = [assetsResolvedDir, cwd];
  if (resolved.path) {
    const targetDir = resolved.type === 'file' ? path.dirname(resolved.path) : resolved.path;
    if (!allowedDirs.includes(targetDir)) allowedDirs.push(targetDir);
  }

  const server = createHttpServer({
    assetsDir: assetsResolvedDir,
    renderMarkdown: (fp) => generateFullPage(fp, assetsResolvedDir),
    allowedDirs,
  });

  // Bind to 127.0.0.1 explicitly — prevents LAN exposure of served files.
  server.listen(port, '127.0.0.1', () => {
    const url = buildUrl(port, resolved.type, resolved.path);
    writePidFile(port, process.pid);
    setupShutdownHandlers(port, () => { server.close(); });

    if (args.foreground || args.isChild || process.env.the project environment) {
      console.log(JSON.stringify({ success: true, url, path: resolved.path, port, mode: resolved.type }));
    } else {
      console.log(`\nMarkdown Reader`);
      console.log(`${'─'.repeat(40)}`);
      console.log(`URL:  ${url}`);
      console.log(`Path: ${resolved.path}`);
      console.log(`Port: ${port}`);
      console.log(`Mode: ${resolved.type === 'file' ? 'File Viewer' : 'Directory Browser'}`);
      console.log(`\nPress Ctrl+C to stop\n`);
    }

    if (args.open) openBrowser(url);
  });

  server.on('error', (err) => {
    console.error(`Server error: ${err.message}`);
    process.exit(1);
  });
}

main().catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
