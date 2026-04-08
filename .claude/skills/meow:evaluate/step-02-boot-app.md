# Step 2: Boot App (Conditional)

Start the build if a path was given. Skip if a URL was given. Capture base URL + health check.

## When to Run This Step

- Run if `target_type` is `frontend-path`, `backend-path`, or `cli-binary` (the latter doesn't boot a server but verifies the binary runs)
- Skip if `target_type` is `frontend-url` or `backend-url` — assume already running, jump to health check
- Skip entirely if `--no-boot` flag was passed

## Instructions

### 2a. URL targets — health check only

If `target_type` ends in `-url`:

```bash
# Frontend / backend HTTP health check
if curl -sf --max-time 5 "$target" >/dev/null; then
  echo "Reachable: $target"
  base_url="$target"
else
  echo "BLOCKED: target $target not reachable" >&2
  exit 1
fi
```

If unreachable, status BLOCKED — do not invent verdicts. Report and stop.

### 2b. Path targets — start the build

Detect the build system and start it. Use the simplest invocation:

| Project signal | Command |
|---|---|
| `package.json` with `"dev"` script | `npm run dev` (or `pnpm dev` / `bun dev` / `yarn dev` based on lockfile) |
| `package.json` with `"start"` only | `npm start` |
| `pyproject.toml` + FastAPI / Flask / Django | Read README; use the documented start command |
| `Cargo.toml` | `cargo run` |
| `go.mod` | `go run .` |
| Custom — README has a "Run" section | Follow README |

**Run in background** so the evaluator can probe in parallel:

```bash
cd "$target"
npm run dev > /tmp/evaluator-build.log 2>&1 &
build_pid=$!
echo "Booted PID $build_pid; logs at /tmp/evaluator-build.log"
```

Wait for the server to come up — poll the expected port for up to 30 seconds:

```bash
expected_url="http://localhost:3000"  # or read from output
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  if curl -sf --max-time 2 "$expected_url" >/dev/null; then
    base_url="$expected_url"
    echo "App ready at $base_url after ${i}x2s"
    break
  fi
  sleep 2
done

if [ -z "${base_url:-}" ]; then
  echo "BLOCKED: app did not become ready within 30s. Logs: /tmp/evaluator-build.log" >&2
  cat /tmp/evaluator-build.log >&2
  kill $build_pid 2>/dev/null || true
  exit 1
fi
```

Save `build_pid` for cleanup in step-05.

### 2c. CLI binary targets

```bash
if [ ! -x "$target" ]; then
  echo "BLOCKED: $target is not executable" >&2
  exit 1
fi

# Smoke test: invoke with --help or --version
if "$target" --help >/dev/null 2>&1 || "$target" --version >/dev/null 2>&1; then
  echo "Binary smoke-test passed: $target"
  base_url="$target"  # for CLI, base_url holds the binary path
else
  echo "WARN: binary did not respond to --help or --version. Will probe anyway."
  base_url="$target"
fi
```

### 2d. Capture the build console for evidence

For all target types, the build console (or first request log) goes into evidence:

```bash
console_capture="$evidence_dir/build-startup.log"
if [ -f /tmp/evaluator-build.log ]; then
  cp /tmp/evaluator-build.log "$console_capture"
fi
```

This is the first piece of evidence in the directory. The validate-verdict.sh enforcement works from here on.

## Security Considerations

- **Never run untrusted apps without isolation.** If the target came from a third-party source, run inside a container or `meow:freeze`-restricted directory.
- **Localhost only** — block outbound network from probe by default per `injection-rules.md` Rule 5.
- **Watch the build log for secrets** — if the startup output contains tokens or keys, scrub before saving.

## Output

- `base_url` — set
- `build_pid` — set if path target was booted (for cleanup later)
- `console_capture` — first evidence file written to `evidence_dir`

Print: `"App reachable at {base_url}"`

## Next

Read and follow `step-03-probe-criteria.md`.
