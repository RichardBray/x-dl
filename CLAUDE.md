# CLAUDE.md

## Project overview

x-dl is a CLI tool that extracts and downloads videos from X/Twitter tweets. It uses Playwright (Chromium) to open tweets, captures video URLs from network requests, and downloads via direct fetch or ffmpeg for HLS streams.

## Tech stack

- **Runtime/tooling**: Bun (runtime, package manager, bundler, test runner)
- **Language**: TypeScript
- **Browser automation**: Playwright (Chromium)
- **Video processing**: ffmpeg (for HLS/m3u8 streams)

## Project structure

```
src/
  index.ts        # CLI entry point and orchestration
  extractor.ts    # Playwright-based video URL extraction
  downloader.ts   # Direct HTTP video download with progress
  ffmpeg.ts       # HLS download via ffmpeg with spinner
  installer.ts    # Dependency installation (Playwright, ffmpeg)
  utils.ts        # URL parsing, filename generation, helpers
  types.ts        # TypeScript type definitions
bin/              # CLI entry scripts (x-dl, xld)
test/
  unit/           # Unit tests (bun:test)
  integration/    # Integration tests with mock server
  e2e/            # End-to-end download tests (shell script)
```

## Common commands

```sh
bun install                      # Install dependencies
bun test                         # Run all tests
bun test test/unit/              # Unit tests only
bun run dev -- <url>             # Run from source
./test/e2e/download.sh           # Run e2e download tests (requires network)
```

## Building

```sh
bun run build                    # Bundle for Bun runtime → dist/
bun run build:macos-arm64        # Compile standalone binary (Apple Silicon)
bun run build:macos-intel        # Compile standalone binary (Intel Mac)
bun run build:linux-x64          # Compile standalone binary (Linux)
```

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
