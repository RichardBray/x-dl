![x-dl](./x-dl.png)

# x-dl

> ⚠️ **Warning:** This project was vibe coded and is a work in progress. It's not perfect—please use at your own risk.

Extract videos from X (formerly Twitter) tweets.

## Experimental Alpha Features

The following features are marked as ALPHA and experimental:

- **Private Tweet Detection**: `isPrivateTweet()` function and related error handling
- **Authentication**: `--login` and `--verify-auth` CLI flags for bypassing login walls
- **Protected Account Handling**: `verifyAuth()` method and auth cookie management

These features:
- May not work reliably with all X/Twitter pages
- Could produce false positives/negatives in detection
- May be removed or changed without warning
- Are not suitable for production use

Use these features at your own risk.

## Features

- ✅ Extract videos from public X/Twitter tweets
- ✅ Supports multiple formats (mp4, webm, gif, etc.)
- ✅ Automatic format selection (highest quality)
- ✅ Download videos directly or just get of URL

## Quick Install

**One-line installer (macOS or Linux):**

```bash
curl -fsSL https://github.com/RichardBray/x-dl/releases/latest/download/install.sh | bash
```

This will:
- Detect your platform (macOS/Linux) and architecture (ARM64/x86_64)
- Download the appropriate binary
- Verify the download with SHA256 checksums
- Install to `~/.local/bin/x-dl`
- Add to PATH if needed
- Prompt to install Playwright Chromium

**After installation:**

Reload your shell or run:
```bash
source ~/.bashrc   # or ~/.zshrc
```

Then run:
```bash
x-dl --help
x-dl install          # Install Playwright Chromium
x-dl https://x.com/user/status/123456
``` 

## How It Works

`x-dl` launches Chromium via Playwright, opens tweet, and looks for media requests to `video.twimg.com`.

- **Primary signal:** network responses to `video.twimg.com`
- **Fallbacks:** Performance API (`performance.getEntriesByType('resource')`) and DOM inspection (`<video>` / `<source>`)
- **Selection:**
  - filters out audio-only tracks (URLs containing `/aud/` or `mp4a`)
  - prefers progressive files (mp4/webm) when available
  - otherwise returns an HLS playlist (`.m3u8`) when that's all X exposes
- **Download:**
  - mp4/webm/gif files: direct download
  - HLS (m3u8) playlists: downloads via ffmpeg to produce mp4
  - If direct download fails with 401/403 auth errors and `--profile` is used, automatically retries using authenticated Playwright requests
- **Auth:** with `--profile`, Playwright reuses cookies/session from a persistent profile directory
- **ffmpeg:** checked at runtime and auto-installed when possible

Examples:

```bash
# Print the best video URL (any supported format)
x-dl --url-only https://x.com/WesRoth/status/2013693268190437410
```

```bash
# Log in once (interactive browser), saving cookies to a profile dir
x-dl --login --profile ~/.x-dl-profile

# Then extract using the logged-in session
x-dl --profile ~/.x-dl-profile --url-only https://x.com/WesRoth/status/2013693268190437410
```

When downloading an HLS (m3u8) playlist, the tool automatically uses ffmpeg:

```bash
# This will use ffmpeg to download and convert m3u8 to mp4
x-dl https://x.com/user/status/123456
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
- ffmpeg (for HLS/m3u8 downloads, auto-installed when possible)

### Install the tool

```bash
cd x-dl
bun install
```

### Install dependencies

After installing the tool, you can install Playwright Chromium:

```bash
# Install Playwright Chromium only
x-dl install

# Install Chromium + ffmpeg + Linux system dependencies (may require sudo on Linux)
x-dl install --with-deps
```

The `install` command:
- Checks if Playwright Chromium is already installed
- Installs Chromium if needed (no sudo required)
- With `--with-deps`, also installs ffmpeg and Linux system dependencies
- Works both when running via Bun and when using a compiled single-file binary

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

### Install Dependencies

Install Playwright Chromium:

```bash
x-dl install
```

Install Chromium plus ffmpeg and Linux system dependencies:

```bash
x-dl install --with-deps
```

**Note:** `--with-deps` may require sudo on Linux to install system packages.

### Options

| Option | Description |
|--------|-------------|
| `--url, -u <url>` | Tweet URL to extract from |
| `--output, -o <path>` | Output directory or file path (default: ~/Downloads) |
| `--url-only` | Only print video URL, don't download |
| `--quality <best|worst>` | Video quality preference (default: best) |
| `--timeout <seconds>` | Page load timeout in seconds (default: 30) |
| `--headed` | Show browser window for debugging |
| `--profile [dir]` | Use a persistent browser profile for authenticated extraction (default: `~/.x-dl-profile`) |
| `--login` | Open X in a persistent profile and wait for you to log in |
| `--help, -h` | Show help message |

**Note:** The `-o` option accepts any file extension. If you specify a path with an extension (e.g., `video.mp4`, `video.webm`), that format will be used. Otherwise, the format is auto-detected from the extracted video.

### Examples

**Download to default location (~/Downloads):**
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
2. Check ffmpeg availability (for HLS support)
3. Validate tweet URL
4. Open tweet in a headless browser
5. Extract video URL (preferring progressive formats like mp4/webm)
6. Download video:
   - For mp4/webm/gif files: direct download with progress reporting
   - For HLS (m3u8) playlists: use ffmpeg to download and convert to mp4
7. Save it with a filename like `username_tweetid.{ext}` (extension based on format)

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
📁 Output path: ~/Downloads/Remotion_2013626968386765291.mp4
📊 Total size: 15.23 MB
⏳ Progress: 100.0% (15.23 MB/15.23 MB)
✅ Download completed in 0:45
📦 Final size: 15.23 MB

✅ Video saved to: ~/Downloads/Remotion_2013626968386765291.mp4
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
 ├── src/
 │   ├── index.ts       # CLI entry point
 │   ├── extractor.ts   # Video extraction logic
 │   ├── downloader.ts  # Download logic (Bun fetch)
 │   ├── ffmpeg.ts      # HLS download via ffmpeg
 │   ├── installer.ts   # Dependency management (Playwright + ffmpeg)
 │   ├── types.ts       # TypeScript interfaces
 │   ├── utils.ts       # Helper functions
 │   └── postinstall.ts # Post-install setup script
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

### "ffmpeg is not available" or "ffmpeg is missing required capabilities"

If you see this error when trying to download an HLS (m3u8) video, ffmpeg is either not installed or lacks the required features.

**Auto-install:**
The tool will attempt to auto-install ffmpeg when you run `bun install` or when needed.

**Manual install:**
```bash
macOS: brew install ffmpeg
Linux:  sudo apt-get install ffmpeg  # or dnf/yum/pacman equivalent
```

After installation, run:
```bash
bun run src/index.ts <url>
```

The tool will verify ffmpeg capabilities automatically.

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
