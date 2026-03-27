/**
 * Minimal spinner for CLI feedback. Zero dependencies.
 * Writes to stderr so stdout stays clean for --json output.
 * Disabled in: non-TTY, CI, JSON mode.
 */

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const INTERVAL = 80;

let timer: ReturnType<typeof setInterval> | null = null;
let frameIndex = 0;

/** Whether spinner should be active (TTY, not CI, not JSON) */
function canSpin(): boolean {
  return (
    Boolean(process.stderr.isTTY) &&
    !process.env.CI &&
    !process.env.MEOWKIT_JSON
  );
}

/** Show cursor on exit (cleanup after SIGINT) */
function ensureCursorVisible(): void {
  if (process.stderr.isTTY) {
    process.stderr.write("\x1B[?25h");
  }
}

// Always restore cursor on exit
process.on("exit", ensureCursorVisible);

export function start(message: string): void {
  if (!canSpin()) {
    process.stderr.write(`  ${message}\n`);
    return;
  }

  stop(); // Clear any existing spinner
  process.stderr.write("\x1B[?25l"); // Hide cursor
  frameIndex = 0;

  timer = setInterval(() => {
    const frame = FRAMES[frameIndex % FRAMES.length];
    process.stderr.write(`\r  ${frame} ${message}`);
    frameIndex++;
  }, INTERVAL);
}

export function succeed(message: string): void {
  stop();
  process.stderr.write(`\r  \x1B[32m✓\x1B[0m ${message}\n`);
}

export function fail(message: string): void {
  stop();
  process.stderr.write(`\r  \x1B[31m✗\x1B[0m ${message}\n`);
}

function stop(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (process.stderr.isTTY) {
    process.stderr.write("\r\x1B[K"); // Clear line
    process.stderr.write("\x1B[?25h"); // Show cursor
  }
}
