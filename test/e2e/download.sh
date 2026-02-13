#!/usr/bin/env bash
# End-to-end download tests for x-dl
# Usage: ./test/e2e/download.sh
#
# Requires: bun, ffmpeg, Playwright Chromium installed
# These tests hit real X/Twitter URLs so they need network access.
# Note: Many tweets require authentication; tests use known public HLS tweets.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BIN="bun run $SCRIPT_DIR/../../bin/x-dl"
TMPDIR_BASE=$(mktemp -d)
PASS=0
FAIL=0

# Known working public tweet with HLS video
PUBLIC_HLS_URL="https://x.com/thorstenball/status/2022310010391302259"

cleanup() {
  rm -rf "$TMPDIR_BASE"
}
trap cleanup EXIT

pass() {
  echo "  ✅ PASS: $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "  ❌ FAIL: $1 — $2"
  FAIL=$((FAIL + 1))
}

run_test() {
  local name="$1"
  shift
  echo ""
  echo "━━━ $name ━━━"
  "$@"
}

# ──────────────────────────────────────────────
# Test 1: Download HLS tweet via ffmpeg
# ──────────────────────────────────────────────
test_hls_download() {
  local outdir="$TMPDIR_BASE/hls"
  mkdir -p "$outdir"

  local output
  output=$($BIN "$PUBLIC_HLS_URL" -o "$outdir/hls.mp4" 2>&1) || true

  if [[ -f "$outdir/hls.mp4" ]]; then
    local size
    size=$(stat -f%z "$outdir/hls.mp4" 2>/dev/null || stat -c%s "$outdir/hls.mp4" 2>/dev/null)
    if [[ "$size" -gt 100000 ]]; then
      pass "HLS video downloaded (${size} bytes)"
    else
      fail "HLS video too small" "${size} bytes"
    fi
  else
    fail "HLS file not created" "$(echo "$output" | tail -3)"
  fi

  # Verify spinner resolved with completion message
  if echo "$output" | grep -q 'HLS download completed'; then
    pass "HLS spinner resolved with completion message"
  else
    fail "HLS spinner did not show completion" "$(echo "$output" | tail -3)"
  fi

  # Verify final output contains saved message
  if echo "$output" | grep -qE '✅.*saved'; then
    pass "Output shows saved confirmation"
  else
    fail "Missing saved confirmation" "$(echo "$output" | tail -3)"
  fi
}

# ──────────────────────────────────────────────
# Test 2: Custom output path with -o flag
# ──────────────────────────────────────────────
test_custom_output_path() {
  local outdir="$TMPDIR_BASE/custom"
  mkdir -p "$outdir"

  local output
  output=$($BIN "$PUBLIC_HLS_URL" -o "$outdir/my_custom_video.mp4" 2>&1) || true

  if [[ -f "$outdir/my_custom_video.mp4" ]]; then
    pass "Custom output path works"
  else
    fail "Custom output path file not found" "$(echo "$output" | tail -3)"
  fi
}

# ──────────────────────────────────────────────
# Test 3: Invalid URL shows error, no hanging
# ──────────────────────────────────────────────
test_invalid_url() {
  local url="https://x.com/nobody/status/99999999999999999"
  local outdir="$TMPDIR_BASE/invalid"
  mkdir -p "$outdir"

  local output
  local exit_code=0
  output=$($BIN "$url" -o "$outdir/bad.mp4" 2>&1) || exit_code=$?

  if [[ "$exit_code" -ne 0 ]]; then
    pass "Invalid URL exits with non-zero code ($exit_code)"
  else
    fail "Invalid URL should fail" "exited 0"
  fi

  # Ensure no spinner characters left in final output line
  local last_line
  last_line=$(echo "$output" | tail -1)
  if echo "$last_line" | grep -qE '[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏].*Downloading'; then
    fail "Spinner frame leaked into final output" "$last_line"
  else
    pass "No spinner leak in output"
  fi
}

# ──────────────────────────────────────────────
# Test 4: Not a video tweet shows clear error
# ──────────────────────────────────────────────
test_not_a_video() {
  # A text-only tweet (Elon's first tweet)
  local url="https://x.com/elonmusk/status/1"
  local outdir="$TMPDIR_BASE/novideo"
  mkdir -p "$outdir"

  local output
  local exit_code=0
  output=$($BIN "$url" -o "$outdir/nope.mp4" 2>&1) || exit_code=$?

  if [[ "$exit_code" -ne 0 ]]; then
    pass "Non-video tweet exits with error"
  else
    fail "Non-video tweet should fail" "exited 0"
  fi
}

# ──────────────────────────────────────────────
# Test 5: No orphan ffmpeg processes after download
# ──────────────────────────────────────────────
test_clean_exit() {
  # Check that previous HLS tests didn't leave orphan ffmpeg processes
  sleep 2
  local orphans
  orphans=$(pgrep -cf 'ffmpeg.*m3u8' 2>/dev/null || echo "0")

  if [[ "$orphans" -eq 0 ]]; then
    pass "No orphan ffmpeg processes"
  else
    fail "Orphan ffmpeg processes detected" "count=$orphans"
  fi
}

# ──────────────────────────────────────────────
# Run all tests
# ──────────────────────────────────────────────
echo "🧪 x-dl end-to-end tests"
echo "   tmp dir: $TMPDIR_BASE"

run_test "HLS (ffmpeg) download" test_hls_download
run_test "Custom output path" test_custom_output_path
run_test "Invalid URL handling" test_invalid_url
run_test "Non-video tweet" test_not_a_video
run_test "Clean exit (no orphans)" test_clean_exit

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━"
echo "Results: $PASS passed, $FAIL failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
