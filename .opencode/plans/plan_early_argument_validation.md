# Plan: Add Early Argument Validation and --version Flag

## Overview

Implement Option 3 (Hybrid approach) to fix UX issue where invalid commands waste time checking dependencies before showing errors.

## Problem

When user runs invalid command like `x-dl --version`:
1. App checks Playwright Chromium (~2 seconds)
2. App checks ffmpeg (~1 second)
3. Only then shows error: "No URL provided"

This is inefficient and confusing.

## Solution

**Hybrid approach combining:**
1. Add explicit `--version` flag (quick win)
2. Move argument parsing before dependency checks (long-term fix)
3. Early validation to catch invalid commands immediately

## Implementation Plan

### Step 1: Add --version Flag

**File:** `src/index.ts`

**Changes in `parseArgs()` function:**
- Add `--version` / `-v` case in switch statement
- Call new `showVersion()` function and exit

**Add new function:**
```typescript
function showVersion(): void {
  console.log('0.1.0');
  process.exit(0);
}
```

**Location:** After `showInstallHelp()` function, before `getOutputPath()`

### Step 2: Add --version Flag to parseArgs()

**Location:** `src/index.ts` line 54-129 (parseArgs function)

**Add case in switch statement:**
```typescript
case '--version':
case '-v':
  showVersion();  // This will call process.exit(0)
  break;
```

**Placement:** After `--help` case (around line 119)

### Step 3: Add showVersion() Function

**Location:** After `showInstallHelp()` function (around line 209)

**Implementation:**
```typescript
function showVersion(): void {
  console.log('0.1.0');
  process.exit(0);
}
```

### Step 4: Reorder main() Validation Logic

**Location:** `src/index.ts` line 309-325 (main function)

**Changes:**

1. Move `parseArgs()` call to line 311 (immediately after install check)
2. Add early validation after parseArgs()
3. Remove redundant URL check at line 360-366 (since we check earlier)

**Detailed changes:**

```typescript
async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv[0] === 'install') {
    await handleInstallMode(argv.slice(1));
    return;
  }

  // Parse args FIRST to catch invalid flags immediately
  const args = parseArgs(argv);

  console.log('🎬 x-dl - X/Twitter Video Extractor\n');

  // Early validation - check if we need dependencies at all
  const needsDependencies = args.login || args.verifyAuth || args.url;

  if (!needsDependencies) {
    const commandName = getCommandName();
    console.error('❌ Error: No URL provided');
    console.error(`\nUsage: ${commandName} <url> [options]`);
    console.error(`Run: ${commandName} --help for more information\n`);
    process.exit(1);
  }

  // Now check dependencies (only if we actually need them)
  const installed = await ensurePlaywrightReady();
  if (!installed) {
    console.error('\n❌ Playwright Chromium is required. Try: bunx playwright install chromium\n');
    process.exit(1);
  }

  const { ensureFfmpegReady } = await import('./installer.ts');
  const ffmpegReady = await ensureFfmpegReady();
  if (!ffmpegReady) {
    console.warn('⚠️ ffmpeg is not available. HLS (m3u8) downloads will not work.');
  }

  // Continue with login, verify-auth, and URL extraction logic...
  // (remove the redundant URL check at line 360-366)
}
```

**Note:** Need to remove the duplicate URL validation at line 360-366 since we're checking earlier now.

### Step 5: Remove Redundant URL Check

**Location:** Line 360-366 in main()

**Remove this block:**
```typescript
if (!args.url) {
  const commandName = getCommandName();
  console.error('❌ Error: No URL provided');
  console.error(`\nUsage: ${commandName} <url> [options]`);
  console.error(`Run: ${commandName} --help for more information\n`);
  process.exit(1);
}
```

This is redundant since we now check earlier with `needsDependencies` logic.

## Files Modified

- `src/index.ts`
  - Add `showVersion()` function
  - Add `--version` / `-v` case in `parseArgs()`
  - Reorder `main()` to validate args before dependency checks
  - Remove redundant URL validation

## Testing Plan

### Test 1: --version Flag
```bash
x-dl --version
# Expected: 0.1.0 (current version)
# Expected: Exits with code 0
# Expected: No dependency checks (fast)
```

### Test 2: Short Version Flag
```bash
x-dl -v
# Expected: 0.1.0
# Expected: Exits with code 0
# Expected: No dependency checks (fast)
```

### Test 3: Invalid Flag
```bash
x-dl --invalid-flag
# Expected: Shows usage immediately
# Expected: No dependency checks (fast)
# Expected: Exits with code 1
```

### Test 4: No Arguments
```bash
x-dl
# Expected: Shows usage immediately
# Expected: No dependency checks (fast)
# Expected: Exits with code 1
```

### Test 5: Valid URL (Regression Test)
```bash
x-dl https://x.com/user/status/123456
# Expected: Checks dependencies (normal behavior)
# Expected: Extracts video
# Expected: Works as before
```

### Test 6: Install Command (Regression Test)
```bash
x-dl install
# Expected: Works as before
# Expected: No early validation
# Expected: Installs dependencies
```

### Test 7: Login Command (Regression Test)
```bash
x-dl --login
# Expected: Checks dependencies
# Expected: Opens browser for login
# Expected: Works as before
```

## Success Criteria

- [ ] `--version` flag works and displays version
- [ ] `-v` flag works and displays version
- [ ] Invalid flags show error immediately without dependency checks
- [ ] No arguments show usage immediately without dependency checks
- [ ] Valid URLs still check dependencies (regression test)
- [ ] Install command still works (regression test)
- [ ] Login command still works (regression test)
- [ ] All existing functionality preserved

## Branch Setup

```bash
# Create new branch from main
git checkout main
git pull origin main
git checkout -b feature/early-argument-validation
```

## Summary

This implementation provides:

1. **Immediate error feedback** - Invalid commands don't waste time on dependency checks
2. **Standard --version flag** - Users expect this in CLI tools
3. **Better UX** - Fast response for errors
4. **Minimal changes** - Small refactoring, no major rewrites
5. **Backwards compatible** - All existing functionality preserved

**Expected time savings:**
- Invalid commands: ~3 seconds faster (no dependency checks)
- --version flag: ~3 seconds faster
- Better user experience overall
