'use strict';
// port-corpus-invoke.cjs — map an abstract case invocation onto the PINNED
// (pre-port) implementation.
//
// This module is the recorder's half of the mapping; the replay harness holds
// the node half. They are deliberately separate files: the whole value of the
// corpus is that the two sides were written against the same case list and
// nothing else, so a shared helper that "runs the right one" would quietly let
// one expectation describe both implementations.
//
// The single-path driver is generated here rather than committed, because it
// exists only to reach two module-level functions through the same importlib
// path the fetch-persisting skill script uses. It is written under the case's
// HOME, never inside the project, so a directory scan can never see it.

const path = require('node:path');

const { runScript, writeFile } = require('./port-corpus-env.cjs');

/**
 * Reach the scanner the way an importing consumer does, and print one JSON
 * object per invocation.
 *
 * Field ORDER is fixed here and matched by the port: a findings list whose keys
 * came out in a different order would diff as a behavior change on every
 * fixture and teach a reader to ignore the diff.
 *
 * The boundary check runs first and is additive, so a path outside the project
 * reports the violation AND whatever its content matches.
 */
const SINGLE_PATH_DRIVER = `import importlib.util, json, sys
from pathlib import Path

spec = importlib.util.spec_from_file_location("injection_audit", sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

target, root = Path(sys.argv[2]), Path(sys.argv[3])
findings = []
boundary = module.check_file_outside_project(target, root)
if boundary is not None:
    findings.append(boundary)
findings.extend(module.scan_file(target))

print(json.dumps({
    "path": str(target),
    "findings": [
        {
            "level": f.level,
            "category": f.category,
            "description": f.description,
            "file": f.file,
            "line": f.line,
        }
        for f in findings
    ],
}, separators=(",", ":")))
`;

/**
 * Run one case against the pinned implementation and return its raw streams.
 *
 * `ctx.python` is the interpreter the recorder resolved. It is used explicitly
 * for the two Python entry points AND placed ahead of PATH, because the bash
 * subject resolves `python3` for itself from PATH and the two must be the same
 * interpreter or the fixtures would mix versions.
 */
function invokeBase(ctx, invocation) {
  const auditor = path.join(ctx.projectDir, '.claude/scripts/injection-audit.py');
  const common = { cwd: ctx.projectDir, stdin: '', env: { PATH: ctx.pathWithPython }, home: ctx.home };

  if (invocation.kind === 'scan-dir') {
    return runScript({ script: ctx.python.bin, args: [auditor, ...invocation.args], ...common });
  }

  if (invocation.kind === 'scan-one') {
    const driver = writeFile(ctx.home, 'scan-one-driver.py', SINGLE_PATH_DRIVER);
    return runScript({ script: ctx.python.bin, args: [driver, auditor, invocation.target, ctx.projectDir], ...common });
  }

  if (invocation.kind === 'config') {
    const cli = path.join(ctx.projectDir, '.claude/scripts/bin/workflow-config');
    return runScript({ script: cli, args: invocation.args, ...common });
  }

  throw new Error(`unknown invocation kind: ${invocation.kind}`);
}

module.exports = { SINGLE_PATH_DRIVER, invokeBase };
