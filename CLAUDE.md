# CLAUDE.md

## Local testing with standalone binary

The compiled binary installs to `~/.local/bin/x-dl`. To test a local build:

```sh
# Remove the existing binary
rm ~/.local/bin/x-dl

# Build for Apple Silicon
bun run build:macos-arm64

# Install the new binary
cp dist/xld-macos-apple-silicon ~/.local/bin/x-dl

# Test it
x-dl <tweet-url>
```

## Code conventions

- No external logging library — uses `process.stdout.write` for inline progress/spinners and `console.log`/`console.error` for line output
- Spinner animation runs on a fast interval (80ms); file-size polling runs on a slower interval (2s)
- All spinner/progress lines must be cleared (`\r\x1b[K`) before printing errors on every exit path
- Stream readers must be released in `finally` blocks
- Tests use `bun:test` for unit/integration; e2e tests are a standalone shell script
