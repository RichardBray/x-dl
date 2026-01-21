
 PLAN: Authenticated X Video Extraction (Playwright, Option 1)
 Goal
Replace `agent-browser` with Playwright and implement an authenticated mode that uses a persistent browser profile (`userDataDir`) so login-walled tweets can be extracted by reusing an interactive login session.
 Why This Approach
- X frequently blocks unauthenticated access to tweet media; browser auth is the most reliable path.
- Playwright provides stable, first-class:
  - persistent sessions (userDataDir / storageState)
  - network interception + response inspection
  - tracing/screenshot debugging if needed
- This avoids brittle reverse engineering of X internal APIs.
 UX / CLI Changes
Add flags to the existing CLI:
- `--profile <dir>` (recommended): path to persistent Playwright profile directory (stores cookies/session).
- `--login`: open X in headed mode using `--profile` and wait for user to log in; then exit.
- Reuse existing flags:
  - `--headed` (recommended with `--login`, optional for debugging)
  - `--timeout`, `--url-only`, `--output`, etc.
Recommended behavior:
- Authenticated extraction requires explicit `--profile`.
- `--login` requires `--profile`. (Fail with a clear error if omitted.)
 Dependency Changes
- Add `playwright` dependency.
- Ensure Chromium is installed:
  - Prefer `postinstall`: `playwright install chromium`
  - Provide manual fallback command in error message.
Remove `agent-browser` installation logic.
 Implementation Steps
 1) Replace Installer
File: `src/installer.ts`
- Delete `ensureAgentBrowserInstalled()`.
- Add `ensurePlaywrightReady(): Promise<boolean>`:
  - Attempt to import Playwright.
  - Attempt to launch Chromium (minimal smoke test).
  - If the browser executable is missing, provide a friendly message:
    - `bunx playwright install chromium`
  - Return `true/false` with clear logging.
Update call sites:
- `src/index.ts`
- `check-tweet.ts`
 2) Add Auth Options to Types
File: `src/types.ts`
- Extend `ExtractOptions`:
  - `profileDir?: string`
  - `loginOnly?: boolean` (optional, could also be handled only in CLI)
 3) Replace agent-browser in Extractor with Playwright
File: `src/extractor.ts`
Remove:
- `runAgentBrowser()`
- agent-browser based `openUrl()`, `getPageHtml()`, `close()`
Add Playwright-backed lifecycle:
- Create context:
  - If `profileDir` provided:
    - `chromium.launchPersistentContext(profileDir, { headless: !headed })`
  - Else:
    - `chromium.launch({ headless: !headed })` + `browser.newContext()`
- Create page: `const page = await context.newPage()` (for persistent context too).
Navigation behavior:
- `await page.goto(url, { waitUntil: 'domcontentloaded', timeout })`
- Avoid `networkidle` on X (often never settles).
Primary extraction path: network capture
- Collect candidates from network responses:
  - `page.on('response', resp => { const u = resp.url(); if (u.includes('video.twimg.com') && (u.includes('.mp4') || u.includes('.m3u8'))) collect })`
- After navigation, attempt to trigger media loading:
  - If `video` exists: try `page.evaluate(() => document.querySelectorAll('video').forEach(v => v.play?.().catch(()=>{})))`
  - Optionally click the video container/play button:
    - common candidates: `video`, `[data-testid="videoPlayer"]`, `div[role="button"]` with accessible name matching "Play"
- Wait a bounded time (e.g. 3-8 seconds) for network candidates.
Candidate selection:
- Prefer MP4 over m3u8.
- Choose “best” mp4:
  - parse `.../vid/<WxH>/...` and pick max area
  - fallback to highest bitrate variant if available in URL or metadata
Secondary extraction: Performance API
- `page.evaluate(() => performance.getEntriesByType('resource').map(r => r.name))`
- Filter for `.mp4`/`.m3u8` under `twimg.com`
- Merge with network candidates.
Tertiary extraction: DOM inspection
- Look for `video.currentSrc`, `video.src`, `source[src]`, and `video.poster`.
- If poster is from `pbs.twimg.com/..._thumb/<id>/...`, keep the “construct candidate URLs” approach only as a last resort.
  - This is fragile; treat as best-effort fallback.
Login wall + private tweet detection
- Prefer DOM-based checks:
  - Look for login prompts / overlays (text checks can be flaky).
- Still allow extraction attempt when login wall detected (but surface a better error message if no candidates appear).
Always close:
- Ensure context and browser close in `finally` (even with persistent context).
 4) Downloader: Auth-aware fallback
File: `src/downloader.ts`
Current behavior uses Bun `fetch()`. Keep it.
Add fallback if direct download fails with 401/403:
- If extractor created a Playwright context, use `context.request.get(videoUrl)` to fetch while authenticated.
- Write bytes to disk.
This may require:
- Passing an optional "authenticated fetch" function from extractor to downloader, OR
- Moving the download into extractor when auth is required.
 5) CLI Wiring
File: `src/index.ts`
- Add parsing:
  - `--profile <dir>`
  - `--login`
- Replace `ensureAgentBrowserInstalled()` with `ensurePlaywrightReady()`.
`--login` flow:
- Launch persistent context with `headed: true` (regardless of `--headed`).
- Open `https://x.com/home` (or the login flow URL).
- Print instructions: "Log in, then press Enter to close."
- Close context and exit 0.
Extraction flow:
- Create `VideoExtractor({ timeout, headed, profileDir })`
- Proceed like today.
 6) Update helper script
File: `check-tweet.ts`
- Replace installer call and pass `--profile` if provided (optional enhancement).
- Or keep it simple and just call extractor with no profile unless you add CLI args.
 7) Update Docs
Files:
- `README.md`
- `QUICKSTART.md`
Add:
- Install steps (including `playwright install chromium` if not postinstall)
- Auth usage:
  - `bun run src/index.ts --login --profile ~/.x-dl-profile --headed`
  - `bun run src/index.ts --profile ~/.x-dl-profile <tweet-url>`
- Security note: profile directory contains auth cookies.
 8) Tests
File: `test/integration/extractor.test.ts`
- Replace “which agent-browser” check with Playwright readiness check.
- Keep the local mock server concept.
- Verify:
  - It extracts a mocked `video.twimg.com` URL from network events.
If tests are too heavy for CI, keep them `describe.skip` by default, but ensure they work locally.
 Robustness Checklist
- Bounded waits everywhere (X is dynamic; avoid indefinite waits).
- Avoid `networkidle`.
- Capture both:
  - response URLs
  - performance resources
- Add optional debug tooling later (trace/screenshot), but not required for v1.
 Acceptance Criteria
- `--login --profile <dir>` reliably preserves login for future runs.
- Authenticated extraction returns a non-empty `video.twimg.com/...mp4` URL when the user can view the tweet in a logged-in browser.
- Non-auth tweets still work without a profile.
- Errors are actionable and specific (login required vs private vs no video).
 Decision Made
Authenticated mode requires explicit `--profile` (no implicit storage).
