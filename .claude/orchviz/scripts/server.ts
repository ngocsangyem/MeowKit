/**
 * OrchViz — Server Entry Point
 *
 * CLI: node scripts/server.ts [options]
 *   --port <n>      Port (default 3600, auto-increment to 3650)
 *   --workspace <p>  Workspace path (default CWD)
 *   --plans-dir <p>  Plans directory (default ./plans)
 *   --open           Open browser on start
 *   --stop           Stop all running OrchViz servers
 *   --background     Run as detached background process
 */

import * as path from 'node:path';
import { createHttpServer, broadcast } from './lib/http-server.js';
import { findAvailablePort } from './lib/port-finder.js';
import { writePidFile, stopAllServers, setupShutdownHandlers } from './lib/process-mgr.js';
import { createEnricherState } from '../src/orch-enricher.js';
import { SessionWatcher, setHookActiveSessions } from '../src/session-watcher.js';
import { hookActiveSessions } from './lib/hook-receiver.js';
import { createStateEngine } from './lib/state-engine.js';
import * as eventStore from '../src/event-store.js';
import { log } from '../src/logger.js';

// ── Parse CLI Args ──

const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}
function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

// ── Handle --stop ──

if (hasFlag('stop')) {
  const count = stopAllServers();
  if (count > 0) {
    console.log(JSON.stringify({ success: true, stopped: count }));
  } else {
    console.log(JSON.stringify({ success: true, stopped: 0, message: 'No running servers found' }));
  }
  process.exit(0);
}

// ── Configuration ──

const requestedPort = parseInt(getArg('port') ?? '0', 10) || 0;
const workspace = getArg('workspace') ?? process.cwd();
const plansDir = getArg('plans-dir') ?? path.join(workspace, 'plans');
const shouldOpen = hasFlag('open');
const assetsDir = path.join(import.meta.dirname ?? '.', '..', 'web', 'out');

// ── Start Server ──

async function start(): Promise<void> {
  const port = await findAvailablePort(requestedPort || undefined);

  // Initialize enricher with plans directory
  const enricherState = createEnricherState(plansDir);

  // C3: Wire hook-active sessions tracking to prevent dual-source duplicates
  setHookActiveSessions(hookActiveSessions);

  // Initialize state engine (Phase 3) — processes enriched events into orchestration state
  const stateEngine = createStateEngine(plansDir);

  // Create HTTP server — pass stateEngine for /api/state endpoint
  const server = createHttpServer({
    hookReceiverOptions: {
      enricherState,
      broadcast: (event) => {
        stateEngine.processEvent(event);  // Feed state engine
        broadcast(event);                  // Broadcast to SSE clients
      },
    },
    assetsDir,
    stateEngine,
  });

  // Start session watcher (JSONL tailing)
  const watcher = new SessionWatcher({
    workspace,
    enricherState,
    onEvent: (event) => {
      stateEngine.processEvent(event);  // Feed state engine
      eventStore.append(event.sessionId, event);
      broadcast(event);
    },
    onSessionStart: (sid) => log.info(`Session started: ${sid.slice(0, 8)}`),
    onSessionEnd: (sid) => log.info(`Session ended: ${sid.slice(0, 8)}`),
  });

  // Listen
  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}`;

    writePidFile(port);
    setupShutdownHandlers(port, () => {
      watcher.stop();
      eventStore.closeAll();
      server.close();
    });

    watcher.start();

    // Print startup JSON for programmatic consumption
    const startupInfo = {
      success: true,
      url,
      port,
      hookUrl: `${url}/hook`,
      sseUrl: `${url}/events`,
      workspace,
      plansDir,
    };
    console.log(JSON.stringify(startupInfo));

    // Human-readable banner
    log.info(`\n  OrchViz Dashboard:  ${url}`);
    log.info(`  Hook endpoint:     ${url}/hook`);
    log.info(`  SSE stream:        ${url}/events`);
    log.info(`  Workspace:         ${workspace}`);
    log.info(`  Plans:             ${plansDir}\n`);

    // Open browser
    if (shouldOpen) {
      import('node:child_process').then(({ exec }) => {
        const cmd = process.platform === 'darwin' ? 'open' :
                    process.platform === 'win32' ? 'start' : 'xdg-open';
        exec(`${cmd} ${url}`);
      });
    }
  });
}

start().catch((err) => {
  log.error('Failed to start server:', err);
  process.exit(1);
});
