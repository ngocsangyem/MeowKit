/**
 * Thin logger shim for core modules.
 * Maps the logger API to console calls — mewkit uses console directly.
 */
import pc from "picocolors";

let verbose = false;

export function setVerbose(v: boolean): void {
  verbose = v;
}

export function info(msg: string): void {
  console.log(msg);
}

export function success(msg: string): void {
  console.log(`${pc.green("✓")} ${msg}`);
}

export function warn(msg: string): void {
  console.warn(pc.yellow(`⚠ ${msg}`));
}

export function error(msg: string): void {
  console.error(pc.red(`✗ ${msg}`));
}

export function debug(msg: string): void {
  if (verbose) {
    console.log(pc.dim(`[debug] ${msg}`));
  }
}

/** No-op: structured data is not used in mewkit's console-based output */
export function setData(_key: string, _value: unknown): void {
  // No-op in mewkit context
}
