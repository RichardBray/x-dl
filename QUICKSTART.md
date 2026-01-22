# Quick Start Guide - x-dl

## Installation

1. Navigate to x-dl directory:
```bash
cd x-dl
```

2. Verify dependencies are installed:
```bash
bun install
```

The postinstall script will:
- Install Playwright Chromium
- Check ffmpeg availability and auto-install when possible

3. Test installation:
```bash
bun test test/unit/
```

You should see:
```
31 pass
0 fail
```

2. Verify dependencies are installed:
```bash
bun install
```

3. Test the installation:
```bash
bun test test/unit/
```

You should see:
```
31 pass
0 fail
```

## Basic Usage

### Check if a tweet can be extracted

Before attempting to download, check if the tweet is accessible:

```bash
bun run check https://x.com/user/status/123456
```

 **Possible results:**

 ✅ **SUCCESS** - The tweet can be extracted
```
✅ SUCCESS: This tweet can be extracted!
   Video URL: https://video.twimg.com/...
   Format: mp4  # or m3u8, webm, gif, etc.
```

 ❌ **FAILED** - The tweet cannot be extracted
```
❌ FAILED: This tweet cannot be extracted
   Reason: This tweet requires authentication...
```

### Download a video

If the check succeeds, download the video:

```bash
bun run src/index.ts https://x.com/user/status/123456
```

### Get video URL only (no download)

```bash
bun run src/index.ts --url-only https://x.com/user/status/123456
```

### Download to specific location

```bash
bun run src/index.ts -o ~/Downloads https://x.com/user/status/123456
```

### Download with custom filename

```bash
bun run src/index.ts -o ~/Downloads/my-video.mp4 https://x.com/user/status/123456
bun run src/index.ts -o ~/Downloads/my-video.webm https://x.com/user/status/123456
```

Note: The `-o` option accepts any file extension. If you specify a path with an extension, that format will be used.

## Common Issues

### Issue: "This tweet requires authentication"

**Cause:** Most tweets now require login to view.

**Solution:** Use authenticated mode:
```bash
# Log in once (interactive)
bun run src/index.ts --login --profile ~/.x-dl-profile

# Then extract using the saved session
bun run src/index.ts --profile ~/.x-dl-profile https://x.com/user/status/123456
```

### Issue: "Playwright Chromium is not ready"

**Cause:** Chromium browser for Playwright isn't installed.

**Solution:**
```bash
bunx playwright install chromium
```

### Issue: "ffmpeg is not available"

**Cause:** ffmpeg is not installed (needed for HLS/m3u8 downloads).

**Solution:**
```bash
macOS:   brew install ffmpeg
Linux:    sudo apt-get install ffmpeg  # or dnf/yum/pacman equivalent
Windows:  winget install ffmpeg
```

The tool will attempt to auto-install ffmpeg during `bun install`.

### Issue: "No video found in this tweet"

**Cause:** The tweet doesn't contain a video (might be images only or text).

**Solution:** Verify the tweet actually has video content.

### Issue: "Invalid X/Twitter URL"

**Cause:** URL format is incorrect.

**Solution:** Use valid URL format:
- ✅ `https://x.com/user/status/123456`
- ✅ `https://twitter.com/user/status/123456`
- ❌ `x.com/user/123456`
- ❌ `https://google.com`

## Examples

### Example 1: Basic download
```bash
bun run src/index.ts https://x.com/Remotion/status/2013626968386765291
```

 Expected output:
```
 🎬 x-dl - X/Twitter Video Extractor
 
 🔍 Checking for Playwright (Chromium)...
 ✅ Playwright Chromium is ready
 🔍 Checking for ffmpeg...
 ✅ ffmpeg is ready
 🎬 Extracting video from: https://x.com/...
 📝 Tweet: @Remotion (ID: 2013626968386765291)
 ...
 ```

### Example 2: Download to folder
```bash
bun run src/index.ts -o ~/Videos https://x.com/user/status/123456
```

This will download to: `~/Videos/user_123456.mp4`

### Example 3: Get URL only
```bash
bun run src/index.ts --url-only https://x.com/user/status/123456
```

Output just the video URL:
```
https://video.twimg.com/ext_tw_video/...
```

### Example 4: Debug with headed mode
```bash
bun run src/index.ts --headed https://x.com/user/status/123456
```

This shows the browser window for debugging.

### Example 5: Check before downloading
```bash
# First check if extractable
bun run check https://x.com/user/status/123456

# If successful, then download
bun run src/index.ts https://x.com/user/status/123456
```

## Testing

Run the test suite:
```bash
# All tests
bun test

# Unit tests only
bun test test/unit/

# Integration tests (requires Playwright Chromium)
bun test test/integration/
```

## Help

Get full help:
```bash
bun run src/index.ts --help
```

## Tips

1. **Always check first:** Use `bun run check` before attempting download
2. **Use --headed for debugging:** If extraction fails, try `--headed` to see what's happening
3. **Increase timeout for slow connections:** Use `--timeout 60` for 60 seconds
4. **Try different browsers:** If using headed mode, you can see login issues
5. **Check filename conflicts:** The tool will use `username_tweetid.{ext}` format (extension based on detected video format)

## Troubleshooting Commands

### Check installation
```bash
which bun
```

### Verify network
```bash
ping video.twimg.com
curl -I https://video.twimg.com
```

### Test with a simple page
```bash
bun run check https://example.com
```

## Advanced Usage

### Custom timeout
```bash
bun run src/index.ts --timeout 120 https://x.com/user/status/123456
```

### Batch processing (shell script)
```bash
#!/bin/bash
for url in $(cat urls.txt); do
  bun run src/index.ts -o ~/Videos "$url"
done
```

### Quality preference
```bash
bun run src/index.ts --quality best https://x.com/user/status/123456
```

## Getting Help

If you encounter issues:

1. Check [TESTING_SUMMARY.md](TESTING_SUMMARY.md) for known issues
2. Check [README.md](README.md) for detailed documentation
3. Run tests to verify installation: `bun test test/unit/`
4. Try with `--headed` to see what's happening
5. Check if the tweet loads in incognito mode first

## Limitations

- **Public tweets only**: Private/protected tweets cannot be extracted
- **Authentication**: Most tweets require login (check first!)
- **Time-limited**: Video URLs may expire

See [README.md](README.md) for full details on limitations.

---

**Ready to start?** Try the check command first:
```bash
cd x-dl
bun run check <your-tweet-url>
```
