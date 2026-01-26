# Manual Verification Guide for Auth Checks

This document outlines the manual verification steps for testing authentication checks in x-dl. These tests verify that the application correctly detects and handles login walls, protected accounts, and authentication scenarios.

## Prerequisites

Before running manual verification tests, ensure:

1. x-dl is built and the CLI is accessible
2. You have a valid X/Twitter account for authentication tests
3. You have a profile directory ready (e.g., `~/.x-dl-profile`)
4. Browser binaries are installed (Chrome/Chromium)

## Manual Verification Steps

### Step 1: Test Login and Profile Setup

**Command:**
```bash
xld --login --profile ~/.x-dl-profile --browser-channel chrome
```

**Expected Behavior:**
- Opens X/Twitter in headless Chrome
- Loads existing cookies/session if profile exists
- If first time, automatically authenticates and saves credentials
- Creates profile directory and stores browser context

**Verification Checklist:**
- [ ] Command executes without errors
- [ ] Browser window/process starts
- [ ] Profile directory `~/.x-dl-profile` exists after command completes
- [ ] Cookies are saved in the profile

**What This Tests:**
- `createContextAndPage()` with persistent context
- Browser profile creation and management
- Cookie storage for authentication

---

### Step 2: Verify Authentication Status

**Command:**
```bash
xld --verify-auth --profile ~/.x-dl-profile
```

**Expected Behavior:**
- Checks if stored auth tokens are valid
- Loads cookies from profile
- Attempts to access X.com/home
- Reports authentication status

**Expected Output Example:**
```
Auth Status:
- Auth token present: Yes
- Can access X.com/home: Yes
- Auth cookies found: auth_token, ct0, personalization_id
```

**Verification Checklist:**
- [ ] Command executes without errors
- [ ] Auth token status is correctly reported
- [ ] Home page accessibility is correctly detected
- [ ] Auth cookies are listed

**What This Tests:**
- `findAuthCookies()` function
- `hasCookie()` function with auth_token
- `hasLoginWall()` detection for login wall scenarios
- `verifyAuth()` method in VideoExtractor

---

### Step 3: Test Login Wall Detection with URL-Only Mode

**Test Case A: Login-Walled Tweet**
```bash
xld --profile ~/.x-dl-profile --url-only https://x.com/user/status/TWEET_ID_BEHIND_WALL
```

**Expected Behavior:**
- Detects tweet is behind login wall
- Reports error that authentication is needed
- Returns error classification as LOGIN_WALL
- Suggests using `--login` flag

**Expected Output Example:**
```
ⓘ Login wall detected; trying to extract anyway...
Error: No video URL found. This tweet likely requires authentication.
Run: x-dl --login --profile ~/.x-dl-profile
Error Classification: LOGIN_WALL
```

**Verification Checklist:**
- [ ] Login wall is correctly detected
- [ ] Error message suggests authentication
- [ ] Extraction gracefully fails without crashing

**What This Tests:**
- `hasLoginWall()` function with real X.com content
- Login wall detection during actual page load
- Proper error classification (ErrorClassification.LOGIN_WALL)

---

### Step 4: Test Debug Artifacts Collection for Problem Tweets

**Test Case: Problematic Tweet with Debug Output**
```bash
xld --profile ~/.x-dl-profile --debug-artifacts ./debug https://x.com/user/status/PROBLEM_TWEET
```

**Expected Behavior:**
- Attempts to extract video from problematic tweet
- Saves debug artifacts to `./debug` directory on error
- Includes HTML snapshot, screenshot, and optional trace

**Expected Artifacts:**
- `login-wall_TIMESTAMP.html` - HTML of the page
- `login-wall_TIMESTAMP.png` - Screenshot of the page
- Files may have different prefixes based on error type:
  - `login-wall_*` for login wall errors
  - `protected-account_*` for protected account errors
  - `no-video-found_*` for extraction errors without video
  - `extraction-error_*` for other errors

**Verification Checklist:**
- [ ] Debug directory is created
- [ ] HTML file is saved with page content
- [ ] Screenshot is taken and saved
- [ ] Files are named with appropriate error type prefix
- [ ] Timestamps are correctly formatted

**What This Tests:**
- `saveDebugArtifacts()` method
- HTML content extraction and storage
- Screenshot generation
- Debug artifact organization

---

## Test Scenarios for Auth Detection

### Scenario 1: Protected/Private Account

**Identifying a Protected Account Tweet:**
Look for tweets from accounts with the "Protected" badge or tweets showing:
- "This tweet is from an account that is protected"
- "These tweets are protected"
- "Only followers can see..."

**Command:**
```bash
xld --profile ~/.x-dl-profile --debug-artifacts ./debug https://x.com/protected_user/status/TWEET_ID
```

**Expected Result:**
- Detection: `isPrivateTweet()` returns true
- Error: "This tweet is private or protected"
- Classification: PROTECTED_ACCOUNT
- Debug artifacts saved with `protected-account_` prefix

---

### Scenario 2: Login Wall (Without Authentication)

**Identifying a Login Wall:**
- Tweet URL requires login to view
- Page shows "Log in", "Sign in", or "Join the conversation"
- Video is inaccessible without authentication

**Command (without profile):**
```bash
xld --url-only https://x.com/user/status/LOGIN_WALLED_TWEET
```

**Expected Result:**
- Detection: `hasLoginWall()` returns true
- Error: "No video URL found... requires authentication"
- Classification: LOGIN_WALL
- Suggestion: Use `--login --profile` to authenticate

**Command (with profile):**
```bash
xld --profile ~/.x-dl-profile --url-only https://x.com/user/status/LOGIN_WALLED_TWEET
```

**Expected Result (if authenticated):**
- Login wall is bypassed due to authentication
- Video extraction proceeds normally
- If still unable to extract, error reflects the actual issue

---

### Scenario 3: Public Tweet with Video

**Identifying a Public Tweet:**
- Tweet is visible without login
- Has video/media attached
- No authentication prompts

**Command:**
```bash
xld --url-only https://x.com/user/status/PUBLIC_VIDEO_TWEET
```

**Expected Result:**
- No login wall detection
- No private tweet detection
- Video URL is extracted successfully
- Returns valid video URL

---

## Edge Cases to Verify

### Edge Case 1: Expired Authentication

**Setup:**
- Use a profile that was authenticated long ago (days/weeks)
- Delete some auth cookies manually to simulate expiration

**Command:**
```bash
xld --verify-auth --profile ~/.x-dl-profile
```

**Expected Behavior:**
- Reports `canAccessHome: false`
- Message indicates authentication is invalid/expired
- Suggests re-running `--login` to refresh

---

### Edge Case 2: Partial Authentication

**Setup:**
- Profile with some auth cookies present but not all

**Command:**
```bash
xld --verify-auth --profile ~/.x-dl-profile
```

**Expected Behavior:**
- Reports which auth cookies are present
- Attempts to access home page
- Reports whether access is possible

---

### Edge Case 3: Cookie-Required Content

**Scenario:**
- Tweet that requires specific cookies but not full auth

**Commands:**
```bash
# Without profile
xld --url-only https://x.com/user/status/COOKIE_REQUIRED_TWEET

# With profile
xld --profile ~/.x-dl-profile --url-only https://x.com/user/status/COOKIE_REQUIRED_TWEET
```

**Expected Behavior:**
- Without profile: May fail or show login wall
- With profile: Should attempt extraction with available cookies

---

## Code Paths Being Tested

### Auth Detection Functions

These manual tests validate the following code paths:

**1. `hasLoginWall(html: string): boolean`**
- Location: `src/utils.ts:97-114`
- Called in: `src/extractor.ts:98`
- Checks for login indicators + case-sensitive auth prompts
- Returns true when both conditions met

**2. `isPrivateTweet(html: string): boolean`**
- Location: `src/utils.ts:81-95`
- Called in: `src/extractor.ts:88`
- Checks for protected account indicators
- Returns true when protected account text found

**3. `hasCookie(cookies: any[], name: string): boolean`**
- Location: `src/utils.ts:178-180`
- Used in: `src/extractor.ts:556`
- Finds specific cookie by exact name match

**4. `findAuthCookies(cookies: any[]): string[]`**
- Location: `src/utils.ts:182-193`
- Called in: `src/extractor.ts:557-559`
- Returns list of recognized auth cookie names

**5. `VideoExtractor.verifyAuth()`**
- Location: `src/extractor.ts:529-613`
- Command: `--verify-auth`
- Orchestrates auth verification:
  - Loads cookies from profile
  - Checks for auth_token
  - Attempts to load X.com/home
  - Detects login walls
  - Reports status

---

## Continuous Integration Testing

The unit tests in `test/unit/auth.test.ts` cover:

- **41 test cases** for auth functions
- **HTML fixtures** for various auth scenarios
- **Edge cases** and false positive avoidance
- **Cookie detection** logic
- **Integration scenarios** combining multiple checks

Unit tests automatically verify:
- Login wall detection accuracy
- Private tweet detection accuracy
- Cookie presence checking
- Auth cookie collection
- False positive prevention

---

## Troubleshooting Manual Verification

### Issue: Profile Directory Not Created

**Solution:**
- Ensure `~/.x-dl-profile` parent directory exists
- Check filesystem permissions
- Run with `--login` first to create profile

### Issue: Authentication Fails

**Solution:**
- Verify X.com credentials
- Check internet connectivity
- Try clearing profile: `rm -rf ~/.x-dl-profile` and re-authenticate
- Check if account requires 2FA

### Issue: Login Wall Still Detected After Login

**Solution:**
- Profile may be expired
- Run `--verify-auth` to check status
- Run `--login` again to refresh authentication
- Check if tweet is from protected account (different from login wall)

### Issue: Screenshots Not Saving

**Solution:**
- Ensure `./debug` directory is writable
- Create directory if missing: `mkdir -p ./debug`
- Check available disk space
- Some headless environments may not support screenshots

---

## Success Criteria

Manual verification is successful when:

1. **Authentication Setup** works without errors
2. **Auth Verification** correctly reports status
3. **Login Wall Detection** accurately identifies guarded content
4. **Protected Account Detection** distinguishes from login walls
5. **Debug Artifacts** save correctly for troubleshooting
6. **Error Messages** are helpful and suggest proper remediation
7. **Public Content** extracts normally without false auth warnings

---

## Automated Unit Tests

Comprehensive unit tests are in `test/unit/auth.test.ts`:

Run with:
```bash
bun test test/unit/auth.test.ts
```

Or run all unit tests:
```bash
bun test test/unit/
```

The unit tests verify all auth detection logic with 41 test cases covering:
- Login wall indicators
- Protected account indicators
- Cookie detection
- Edge cases and false positives
- Integration scenarios
