import pc from "picocolors";

/** Output modes controlled by --json and --verbose flags */
interface LoggerOptions {
  json: boolean;
  verbose: boolean;
}

/** Accumulated structured data for --json output */
interface JsonOutput {
  success: boolean;
  command: string;
  data: Record<string, unknown>;
  messages: Array<{ level: string; text: string }>;
}

let options: LoggerOptions = { json: false, verbose: false };
let jsonOutput: JsonOutput = { success: true, command: "", data: {}, messages: [] };

/** Initialize logger with CLI flags. Call once at startup. */
export function initLogger(opts: Partial<LoggerOptions> & { command?: string }): void {
  options = { json: opts.json ?? false, verbose: opts.verbose ?? false };
  jsonOutput = { success: true, command: opts.command ?? "", data: {}, messages: [] };
}

/** Info message (always shown in text mode, accumulated in json mode) */
export function info(msg: string): void {
  if (options.json) {
    jsonOutput.messages.push({ level: "info", text: msg });
  } else {
    console.log(msg);
  }
}

/** Success message with green checkmark */
export function success(msg: string): void {
  if (options.json) {
    jsonOutput.messages.push({ level: "success", text: msg });
  } else {
    console.log(`${pc.green("✓")} ${msg}`);
  }
}

/** Warning message */
export function warn(msg: string): void {
  if (options.json) {
    jsonOutput.messages.push({ level: "warn", text: msg });
  } else {
    console.warn(pc.yellow(`⚠ ${msg}`));
  }
}

/** Error message. Sets json output success=false. */
export function error(msg: string): void {
  jsonOutput.success = false;
  if (options.json) {
    jsonOutput.messages.push({ level: "error", text: msg });
  } else {
    console.error(pc.red(`✗ ${msg}`));
  }
}

/** Debug message (only in --verbose mode) */
export function debug(msg: string): void {
  if (options.json) {
    if (options.verbose) jsonOutput.messages.push({ level: "debug", text: msg });
  } else if (options.verbose) {
    console.log(pc.dim(`[debug] ${msg}`));
  }
}

/** Set structured data for json output */
export function setData(key: string, value: unknown): void {
  jsonOutput.data[key] = value;
}

/** Flush json output at end of command. No-op in text mode. */
export function flush(): void {
  if (options.json) {
    console.log(JSON.stringify(jsonOutput, null, 2));
  }
}

/** Check if json mode is active */
export function isJson(): boolean {
  return options.json;
}
