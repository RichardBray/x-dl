![x-dl](./x-dl.png)

# x-dl

> ⚠️ **Warning:** This project was vibe coded and is a work in progress. It's not perfect—please use at your own risk.

Extract videos from X (formerly Twitter) tweets.

## Features

- ✅ Extract videos from public X/Twitter tweets
- ✅ Supports multiple formats (mp4, webm, gif, etc.)
- ✅ Automatic format selection (highest quality)
- ✅ Download videos directly or just get the URL
- ✅ Clip videos to a specific time range (`--from` and `--to`)
- ✅ Download videos from private tweets via CDP mode (connects to your Chrome)
- ❌ Windows support

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
  - In CDP mode, uses your Chrome's authenticated session for private tweets
- **Clipping:**
  - `--from` and `--to` (MM:SS format) trim videos to a specific time range
  - HLS streams are clipped during download with ffmpeg re-encoding
  - MP4 streams download full video, then clip locally
  - Clipped files get a `_clip` suffix in the filename
- **Auth:** CDP mode uses a persistent Chrome profile, reusing your logged-in session
- **ffmpeg:** checked at runtime and auto-installed when possible

Examples:

```bash
# Print the best video URL (any supported format)
x-dl --url-only https://x.com/WesRoth/status/2013693268190437410
```

```bash
# Download a private tweet using CDP mode (connects to your Chrome)
x-dl cdp https://x.com/user/status/123456
```

## Installation

**One-line installer (mecommended):**

```bash
curl -fsSL https://github.com/RichardBray/x-dl/releases/latest/download/install.sh | bash
```

**From Source**

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
| `--from <MM:SS>` | Clip start time in minutes and seconds (e.g. `00:30`) |
| `--to <MM:SS>` | Clip end time in minutes and seconds (e.g. `01:30`) |
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

**Download a private tweet via CDP mode:**
```bash
x-dl cdp https://x.com/user/status/123456
```

See [CDP Mode](#cdp-mode-private-tweets) below for setup instructions.

**Custom timeout:**
```bash
x-dl --timeout 60 https://x.com/user/status/123456
```

**Clip a video to a specific time range:**
```bash
# Download only the 30s–90s portion of a video
x-dl --from 00:30 --to 01:30 https://x.com/user/status/123456

# Download from 1 minute to the end
x-dl --from 01:00 https://x.com/user/status/123456
```

Clipped files are saved with a `_clip` suffix, e.g. `username_123456_clip.mp4`. Both `--from` and `--to` are optional — omitting `--from` starts from the beginning, omitting `--to` runs to the end.

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

### Example Output with Clipping

```
🎬 x-dl - X/Twitter Video Extractor

🔍 Checking for Playwright (Chromium)...
✅ Playwright Chromium is ready
🔍 Checking for ffmpeg...
✅ ffmpeg is ready

🎬 Extracting video from: https://x.com/Remotion/status/2013626968386765291
📝 Tweet: @Remotion (ID: 2013626968386765291)
🌐 Opening tweet in browser...
✅ Page loaded
🔍 Looking for video...
✅ Video extracted: https://video.twimg.com/ext_tw_video/...
📋 Suggested filename: Remotion_2013626968386765291_clip.mp4
📥 Downloading HLS video via ffmpeg...
⠋ Downloading HLS...
✅ HLS download completed

✅ Video saved to: ~/Downloads/Remotion_2013626968386765291_clip.mp4
```

## CDP Mode (Private Tweets)

CDP mode uses Google Chrome with a dedicated profile to download private or login-walled tweets.

### Setup

1. **Google Chrome** must be installed
2. Log in first: `x-dl login`
3. Download private tweets: `x-dl cdp <url>`

### Login

```bash
# Open Chrome to log in to X/Twitter (session is saved for future use)
x-dl login
```

Chrome opens with the X/Twitter login page. Log in normally — x-dl detects the login automatically and closes the browser.

### Examples

```bash
# Download a private tweet
x-dl cdp https://x.com/user/status/123456

# Just get the URL
x-dl cdp --url-only https://x.com/user/status/123456
```

Session data is stored in `~/.x-dl-chrome-profile`. Delete this directory to log out.

## Limitations

- **Clipping requires ffmpeg**: `--from` and `--to` require ffmpeg for processing
- **Clipping time format**: Times must be in MM:SS format (e.g., `00:30`, not `0:30` or `30`)
- **Time-limited URLs**: Video URLs may expire after some time
- **Rate limiting**: X may rate-limit excessive requests
- **CDP mode requires Chrome**: CDP mode needs Google Chrome installed (not Chromium)


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
 │   ├── private.ts     # Private tweet browser session (persistent Chrome profile)
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

### CDP mode doesn't work

- Make sure Google Chrome is installed (not just Chromium)
- Try deleting `~/.x-dl-chrome-profile` and logging in again
- Use `--headed` if you need to debug: the browser window will stay visible

### "This tweet is private or protected"

Use CDP mode to download private tweets: `x-dl cdp <url>`. This uses your Chrome's logged-in session.

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
