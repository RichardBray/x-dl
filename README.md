# x-dl

Extract videos from X (formerly Twitter) tweets.

## Features

- ✅ Extract videos from public X/Twitter tweets
- ✅ Automatic MP4 format selection (highest quality)
- ✅ Download videos directly or just get the URL
- ✅ Private tweet detection with helpful errors
- ✅ Authenticated extraction via persistent browser profile
- ✅ Progress reporting during downloads
- ✅ Headed mode for debugging

## Authentication Note

**Twitter/X now requires authentication to view most tweets.**

This tool supports an authenticated mode using a persistent Playwright browser profile.

## How It Works

`x-dl` launches Chromium via Playwright, opens the tweet, and looks for media requests to `video.twimg.com`.

- **Primary signal:** network responses that include `.mp4` or `.m3u8` URLs
- **Fallbacks:** Performance API (`performance.getEntriesByType('resource')`) and DOM inspection (`<video>` / `<source>`)
- **Selection:**
  - filters out audio-only tracks (URLs containing `/aud/` or `mp4a`)
  - prefers MP4 when a real progressive file exists
  - otherwise returns an HLS playlist (`.m3u8`) when that's all X exposes
- **Auth:** with `--profile`, Playwright reuses cookies/session from a persistent profile directory

Examples:

```bash
# Print the best URL (MP4 if available, otherwise m3u8)
x-dl --url-only https://x.com/WesRoth/status/2013693268190437410
```

```bash
# Log in once (interactive browser), saving cookies to a profile dir
x-dl --login --profile ~/.x-dl-profile

# Then extract using the logged-in session
x-dl --profile ~/.x-dl-profile --url-only https://x.com/WesRoth/status/2013693268190437410
```

If the result is a `.m3u8` playlist, use an external tool to download the actual video:

```bash
yt-dlp "<m3u8-url>"
# or
ffmpeg -i "<m3u8-url>" -c copy out.mp4
```

## Installation

### Prerequisites

- [Bun](https://bun.sh/) (>= 1.0.0)
- Playwright (installed via `bun install`)
- Chromium for Playwright (installed via `bun install` / `postinstall`)

### Install the tool

```bash
cd x-dl
bun install
```

### Create a symlink for easy access (optional)

```bash
bun link
```

Or run directly:

```bash
bun run src/index.ts <url>
```

## Usage

### Basic Usage

Extract and download a video from a tweet:

```bash
x-dl https://x.com/Remotion/status/2013626968386765291
```

### Options

| Option | Description |
|--------|-------------|
| `--url, -u <url>` | Tweet URL to extract from |
| `--output, -o <path>` | Output directory or file path (default: current directory) |
| `--url-only` | Only print the video URL, don't download |
| `--quality <best|worst>` | Video quality preference (default: best) |
| `--timeout <seconds>` | Page load timeout in seconds (default: 30) |
| `--headed` | Show browser window for debugging |
| `--profile [dir]` | Use a persistent browser profile for authenticated extraction (default: `~/.x-dl-profile`) |
| `--login` | Open X in a persistent profile and wait for you to log in |
| `--help, -h` | Show help message |

### Examples

**Download to current directory:**
```bash
x-dl https://x.com/Remotion/status/2013626968386765291
```

**Download to specific directory:**
```bash
x-dl -o ~/Downloads https://x.com/user/status/123456
```

**Only print video URL:**
```bash
x-dl --url-only https://x.com/user/status/123456
```

**Use headed mode for debugging:**
```bash
x-dl --headed https://x.com/user/status/123456
```

**Login once, then reuse the session:**
```bash
# Log in interactively (creates/uses the profile dir)
x-dl --login --profile ~/.x-dl-profile

# Extract using the logged-in session
x-dl --profile ~/.x-dl-profile https://x.com/user/status/123456
```

**Custom timeout:**
```bash
x-dl --timeout 60 https://x.com/user/status/123456
```

## Output

When extracting a video, the tool will:

1. Check that Playwright + Chromium are available
2. Validate the tweet URL
3. Open the tweet in a headless browser
4. Extract the video URL (preferring MP4 format)
5. Download the video with progress reporting
6. Save it with a filename like `username_tweetid.mp4`

### Example Output

```
🎬 x-dl - X/Twitter Video Extractor

🔍 Checking for Playwright (Chromium)...
✅ Playwright Chromium is ready

🎬 Extracting video from: https://x.com/Remotion/status/2013626968386765291
📝 Tweet: @Remotion (ID: 2013626968386765291)
🌐 Opening tweet in browser...
⏳ Waiting for page to load...
✅ Page loaded
🔍 Looking for video...
📡 Found video via network monitoring
✅ Video extracted: https://video.twimg.com/ext_tw_video/...
📋 Suggested filename: Remotion_2013626968386765291.mp4
📥 Downloading video from: https://video.twimg.com/...
📁 Output path: Remotion_2013626968386765291.mp4
📊 Total size: 15.23 MB
⏳ Progress: 100.0% (15.23 MB/15.23 MB)
✅ Download completed in 0:45
📦 Final size: 15.23 MB

✅ Video saved to: Remotion_2013626968386765291.mp4
```

## Limitations

- **Authentication Required**: Most tweets require authentication to view content
- **Public tweets only**: Private or protected tweets cannot be extracted
- **Time-limited URLs**: Video URLs may expire after some time
- **Rate limiting**: X may rate-limit excessive requests
- **Login walls**: Use `--login` and `--profile` to extract login-walled tweets

**How to tell if a tweet can be extracted:**
1. Try opening the tweet in an incognito/private browser window
2. If you see a "Sign up" or "Log in" prompt, this tool cannot extract it
3. If the content loads without login, extraction should work

## Error Handling

The tool will report specific errors for:

- ❌ Invalid URLs
- ❌ Private/protected tweets
- ❌ Tweets without video content
- ❌ Network timeouts
- ❌ Download failures

## Testing

Run the test suite:

```bash
# Run all tests
bun test

# Run only unit tests
bun test test/unit/

# Run integration tests (requires Playwright Chromium)
bun test test/integration/
```

### Running Integration Tests

Integration tests use a mock X/Twitter page and require Playwright Chromium:

```bash
bun test test/integration/
```

### Manual Testing with Real Tweets

To test with real tweets, you can run the tool directly:

```bash
bun run src/index.ts --headed https://x.com/user/status/123456
```

Use `--headed` mode to see the browser for debugging.

## Development

### Project Structure

```
x-dl/
├── src/
│   ├── index.ts       # CLI entry point
│   ├── extractor.ts   # Video extraction logic
│   ├── downloader.ts  # Download logic (Bun fetch)
│   ├── installer.ts   # Dependency management
│   ├── types.ts       # TypeScript interfaces
│   └── utils.ts       # Helper functions
├── test/
│   ├── unit/          # Unit tests
│   ├── integration/   # Integration tests
│   └── test-utils.ts  # Test utilities
└── bin/
    └── x-dl         # Executable
```

### Building

```bash
bun run build
```

## Troubleshooting

### "Playwright Chromium is not ready"

If Chromium is missing, install it with:

```bash
bunx playwright install chromium
```

### Authenticated extraction doesn't work

- Run `x-dl --login --profile ~/.x-dl-profile` and make sure you can view the tweet in that browser
- Then rerun extraction with `--profile ~/.x-dl-profile`

Security note: your profile directory contains authentication cookies.

### "This tweet is private or protected"

Only public tweets can be extracted. Verify that:
- The account is not private/protected
- You're not trying to access sensitive content
- The tweet is publicly accessible

### "No video found in this tweet"

The tweet may not contain a video. Check the tweet URL and verify it contains video content.

### Slow downloads

- Increase timeout with `--timeout` option
- Check your internet connection
- Try at a different time (X may be rate-limiting)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
