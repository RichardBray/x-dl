PLAN: Download Any Format + ffmpeg HLS Support

Goal
- Update this tool so it can download formats beyond mp4 (e.g. gif, webm if encountered) and can download HLS (.m3u8) by invoking ffmpeg.
- Add install-time and runtime checks for ffmpeg presence and required capabilities.
- If ffmpeg is missing (or lacks required features), auto-install ffmpeg when possible; otherwise provide actionable instructions.

Scope and Constraints
- Prefer ffmpeg for HLS; do not use yt-dlp.
- Keep existing Playwright-based extraction approach.
- Avoid breaking existing mp4 behavior and existing CLI UX as much as possible.

Current State (key issues)
- src/index.ts hardcodes output naming and file detection to .mp4.
- src/index.ts refuses to download when extractor returns m3u8.
- src/extractor.ts only considers .mp4 and .m3u8 URLs; it ignores other formats.
- src/installer.ts only checks Playwright Chromium; package.json postinstall only installs Chromium.

High-Level Approach
1) Make output naming extension-aware.
2) Broaden URL format detection so the tool can handle additional extensions.
3) Treat m3u8 as downloadable by running ffmpeg to produce a real media file.
4) Add an ffmpeg readiness check (and best-effort auto-install) during installation + at runtime.
5) Update docs and tests.


1) CLI: Output Path and Extension Handling
File: src/index.ts
- Replace mp4-specific output path logic:
  - Treat `--output/-o` as a file path if it has ANY extension via `path.extname(output) !== ''`.
  - Otherwise treat it as a directory.
- Determine the default output extension:
  - If `result.videoUrl.format === 'm3u8'`, default to 'mp4' (ffmpeg output container).
  - Else if `result.videoUrl.format` is a known extension-like string (e.g. 'gif'), use it.
  - Else fall back to 'mp4'.
- Generate default filename using generateFilename(tweetInfo, extension).
- Ensure directory outputs join correctly even if `-o` does/does not end with '/'.
- Remove the current block that exits when format is 'm3u8'. Instead:
  - If format is 'm3u8', call an ffmpeg-based download function.
  - If format is not m3u8, keep using the existing fetch-based downloader.

Implementation detail suggestion
- Introduce a helper:
  - `getOutputPath(tweetUrl, options, preferredExtension)`
  - preferredExtension derived from the extractor result.


2) Types: Allow More Formats
File: src/types.ts
- Loosen `VideoUrl.format` so it can represent arbitrary formats.
  - Option A (recommended): `format: string` and document that for known cases it returns 'mp4'|'m3u8'|'gif' etc.
  - Option B: keep union but add 'webm'|'mov'|'m4s'... (not scalable).
- Keep existing fields (url/bitrate/width/height) unchanged.


3) Format Detection: Generalize Beyond mp4
File: src/utils.ts
- Update `getVideoFormat(url)` to infer format more generally:
  - Parse pathname extension from URL (after stripping query/hash):
    - If extension exists, return the lowercase extension without the dot.
  - Special-case m3u8 detection still works.
  - Keep current gif heuristics as fallback.
  - If no extension is found, return 'unknown'.

Note
- This enables output naming and selection logic to work for formats beyond mp4.


4) Extractor: Collect and Select Candidates for More Formats
File: src/extractor.ts
- Expand candidate collection:
  - In network response handler and performance/DOM candidate extraction, collect more than just .mp4/.m3u8.
  - Keep filtering to `video.twimg.com` domain.
- Candidate parsing:
  - `toCandidate(url)` should accept format strings beyond mp4/m3u8.
  - Continue to compute width/height/score when patterns exist in URL.
  - Keep special scoring rules:
    - Prefer progressive mp4 when real progressive endpoints exist.
    - Prefer master m3u8 when present.
- Segment avoidance:
  - Do not select tiny init segments by default (e.g. .m4s) unless nothing else exists.
  - Continue using HEAD Content-Length checks for mp4 selection.
- Return best candidate:
  - Prefer real progressive files (mp4/webm/etc) when available.
  - If only m3u8 is available, return m3u8.
  - If only segment files exist, return best available or return m3u8 when present.


5) HLS Download via ffmpeg
File: src/downloader.ts (or new src/ffmpeg.ts)
- Add `downloadHlsWithFfmpeg(options)`:
  - Inputs: `{ playlistUrl: string, outputPath: string }`
  - Spawn:
    - `ffmpeg -y -hide_banner -loglevel error -i "<m3u8>" -c copy -bsf:a aac_adtstoasc "<outputPath>"`
  - Return outputPath on success.
  - On failure, throw an Error with stderr summary.

Behavior
- For `.m3u8`, do NOT use Bun fetch; always use ffmpeg.
- Default output container is mp4 unless user specifies a different extension.
- If the user specifies a non-mp4 container, ffmpeg may fail depending on codecs; surface a clear error.


6) Installer: ffmpeg Check + Best-Effort Auto-Install
File: src/installer.ts
- Add `ensureFfmpegReady(): Promise<boolean>`.
  - Check `ffmpeg` exists in PATH (use existing `commandExists()` or add a simple which-based check).
  - Validate required capabilities by running `ffmpeg -hide_banner -version` and `ffmpeg -hide_banner -protocols` and `ffmpeg -hide_banner -demuxers` (or `-formats`) and parsing output for:
    - protocol: `https`
    - demuxer: `hls`
    - muxer: `mp4`
    - bitstream filter: `aac_adtstoasc` (verify via `ffmpeg -hide_banner -bsfs`)
  - If missing, attempt auto-install (best effort, non-destructive):
    - macOS: use `brew install ffmpeg` if `brew` exists.
    - Linux: detect package manager in order and install:
      - `apt-get install -y ffmpeg`
      - `dnf install -y ffmpeg`
      - `yum install -y ffmpeg`
      - `pacman -S --noconfirm ffmpeg`
      - `apk add ffmpeg`
    - Windows: use `winget install ffmpeg` if available.
  - Re-check capabilities after install.
  - If still not available, print manual instructions and return false.

Wiring
- Update CLI startup to call both:
  - `ensurePlaywrightReady()`
  - `ensureFfmpegReady()`
  - Only require ffmpeg readiness when actually downloading an m3u8, but also run it at install time.


7) package.json postinstall
File: package.json
- Replace `postinstall: playwright install chromium` with a script that runs:
  - Playwright chromium install (existing) AND ffmpeg readiness check.
Possible approaches:
- Add a small bun script `src/postinstall.ts` that:
  - Runs `playwright install chromium` (as currently)
  - Runs `ensureFfmpegReady()`
  - Emits clear output.


8) Docs Updates
Files: README.md, QUICKSTART.md
- Update wording from "mp4-only" to "supports multiple formats".
- Add note:
  - If extraction yields m3u8, tool uses ffmpeg to download.
  - Mention ffmpeg is required and will be auto-installed when possible.
- Update examples:
  - `x-dl <tweet>` downloads mp4 or uses ffmpeg for m3u8.
  - `-o` accepts any file extension.


9) Tests
File: test/unit/url.test.ts
- Update tests that assume default `generateFilename()` is mp4 if the default behavior is changed.
- Add/adjust tests for:
  - `getVideoFormat()` returning extensions for URLs like `.../video.webm`.
  - `getOutputPath()` behavior (if unit-testable) to accept arbitrary extensions.

Integration tests
- Optional: add a mocked m3u8 case and verify that the downloader spawns ffmpeg (may require mocking spawn; otherwise keep as unit-level test around command composition).


Acceptance Criteria
- If extractor returns an mp4 URL, tool downloads as before.
- If extractor returns an m3u8 URL, tool downloads via ffmpeg and writes a playable file (default mp4).
- `-o` can specify arbitrary file extensions; directory outputs generate an extension-appropriate filename.
- Installer checks for ffmpeg and required capabilities; auto-installs when possible.
- Clear, actionable errors when ffmpeg cannot be installed or lacks needed features.
