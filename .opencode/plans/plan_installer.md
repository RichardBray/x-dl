# Plan: Create Installer Script and Setup GitHub Releases

## Overview

Create a one-line curl-based installer that allows users to easily download and install x-dl standalone binary on macOS and Linux.

## Current Status

- ✅ Repo: `git@github.com:RichardBray/x-dl.git`
- ✅ Tags exist: v0.0.1, v0.0.2, v0.1.0
- ✅ Standalone binaries build successfully
- ❌ **No GitHub releases exist yet** (must be created)
- ✅ Latest version: v0.1.0

## Files to Create

### 1. `scripts/install.sh` (~150 lines)
One-line installer script that:
- Detects platform (macOS/Linux) and architecture (ARM64/x86_64)
- Detects shell (bash/zsh/fish)
- Downloads appropriate binary from GitHub releases
- Installs to `~/.local/bin/x-dl`
- Makes binary executable
- Updates PATH if needed
- Prompts user to install Playwright Chromium
- Prints installation summary and next steps

### 2. `STANDALONE_BINARIES.md`
User guide for standalone binaries including:
- Build commands
- Installation instructions
- Usage examples
- Platform-specific notes
- Troubleshooting tips

### 3. Update `README.md`
Add "Quick Install" section:
```markdown
## Quick Install

**macOS or Linux:**

```bash
curl -fsSL https://github.com/RichardBray/x-dl/releases/latest/download/install.sh | bash
```

This will:
- Detect your platform and architecture
- Download the appropriate binary
- Install to `~/.local/bin/x-dl`
- Add to PATH if needed
- Prompt to install Playwright Chromium
```

## GitHub Releases Setup

### Required Release Assets

For each release, publish these files:

| Asset | Platform |
|-------|----------|
| `xld-macos-apple-silicon` | macOS ARM64 (M1/M2/M3) |
| `xld-macos-intel` | macOS x86_64 (Intel) |
| `xld-linux-x64` | Linux x86_64 |
| `install.sh` | Installer script (all platforms) |
| `checksums.txt` | SHA256 checksums for verification |

### Release URL Pattern

The installer expects this URL structure:
```
https://github.com/RichardBray/x-dl/releases/latest/download/xld-macos-apple-silicon
https://github.com/RichardBray/x-dl/releases/latest/download/install.sh
```

### Creating First Release

1. Build all binaries:
   ```bash
   bun run build:standalone
   ```

2. Create checksums:
   ```bash
   cd dist
   shasum -a 256 xld-* > checksums.txt
   ```

3. Create GitHub release for v0.1.0:
   ```bash
   gh release create v0.1.0 --latest --notes "Standalone binaries with one-line installer"
   ```

4. Upload assets:
   ```bash
   gh release upload v0.1.0 dist/xld-macos-apple-silicon
   gh release upload v0.1.0 dist/xld-macos-intel
   gh release upload v0.1.0 dist/xld-linux-x64
   gh release upload v0.1.0 scripts/install.sh
   gh release upload v0.1.0 dist/checksums.txt
   ```

## Installer Script Design

### Detection Logic

```bash
# Platform
OS=$(uname -s)  # Darwin or Linux

# Architecture
ARCH=$(uname -m)  # arm64 or x86_64

# Shell
SHELL_NAME=$(basename "$SHELL")  # bash, zsh, or fish
```

### Platform Mapping

| OS | ARCH | Binary to Download |
|----|-------|-------------------|
| Darwin | arm64 | xld-macos-apple-silicon |
| Darwin | x86_64 | xld-macos-intel |
| Linux | x86_64 | xld-linux-x64 |

### Install Location

- Default: `~/.local/bin/x-dl`
- Create directory if missing: `mkdir -p ~/.local/bin`
- Check if writable (no sudo required)

### Shell Configuration

| Shell | Config File | PATH Command |
|-------|-------------|--------------|
| bash | ~/.bashrc or ~/.bash_profile | `export PATH="$HOME/.local/bin:$PATH"` |
| zsh | ~/.zshrc | `export PATH="$HOME/.local/bin:$PATH"` |
| fish | ~/.config/fish/config.fish | `fish_add_path ~/.local/bin` |

### Chromium Installation Prompt

```bash
echo "Install Playwright Chromium now (~300MB)? [y/N]: "
read -r response
if [[ "$response" =~ ^[Yy]$ ]]; then
    ~/.local/bin/x-dl install
fi
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Unsupported platform |
| 2 | Download failed |
| 3 | Installation failed |
| 4 | Binary verification failed |

## Installer Script Structure

```bash
#!/usr/bin/env bash
set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions:
# - log_info(): Print info messages
# - log_error(): Print error messages and exit
# - detect_platform(): Determine OS and architecture
# - detect_shell(): Determine user's shell
# - download_binary(): Download from GitHub releases
# - verify_binary(): Check if binary is valid
# - install_binary(): Copy to ~/.local/bin
# - update_path(): Add ~/.local/bin to PATH if needed
# - prompt_chromium(): Ask user to install Chromium
# - print_summary(): Show installation summary and next steps

# Main execution flow:
# 1. Print banner
# 2. Detect platform (exit if unsupported)
# 3. Detect shell
# 4. Download binary
# 5. Verify binary
# 6. Install to ~/.local/bin
# 7. Update PATH if needed
# 8. Prompt for Chromium installation
# 9. Print summary
# 10. Print usage examples
```

## Testing Plan

### 1. Test on macOS ARM64 (M1/M2/M3)
```bash
./scripts/install.sh
# Verify binary installed
~/.local/bin/x-dl --help
```

### 2. Test on macOS Intel (x86_64)
Same as above, on Intel Mac

### 3. Test on Linux x86_64
```bash
./scripts/install.sh
# Verify binary installed
~/.local/bin/x-dl --help
```

### 4. Test with each shell

**bash:**
```bash
bash -c './scripts/install.sh'
# Verify PATH in ~/.bashrc
```

**zsh:**
```bash
zsh -c './scripts/install.sh'
# Verify PATH in ~/.zshrc
```

**fish:**
```bash
fish -c './scripts/install.sh'
# Verify PATH in ~/.config/fish/config.fish
```

### 5. Test Chromium installation prompt
```bash
./scripts/install.sh
# Answer 'y' to install
# Answer 'N' and verify manual instructions shown
```

### 6. Test PATH not already set
- Temporarily remove ~/.local/bin from PATH
- Run installer
- Verify it adds PATH to shell config
- Reload shell
- Verify `x-dl` command works

### 7. Test error conditions

**Unsupported platform:**
```bash
# Mock unsupported OS
OS=FakeOS ./scripts/install.sh
# Should exit with code 1
```

**Download failure:**
```bash
# Use invalid release URL
# Should exit with code 2
```

**Permissions error:**
```bash
# Try to install to read-only directory
# Should exit with code 3
```

## Documentation Updates

### README.md - Add "Quick Install" Section

After the Installation section, add:

```markdown
## Quick Install

**One-line installer (macOS or Linux):**

```bash
curl -fsSL https://github.com/RichardBray/x-dl/releases/latest/download/install.sh | bash
```

This will:
- Detect your platform (macOS/Linux) and architecture (ARM64/x86_64)
- Download the appropriate binary
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

### See `STANDALONE_BINARIES.md` for more details.
```

### STANDALONE_BINARIES.md Content

Comprehensive guide including:
- Build commands
- Binary location
- Installation instructions
- Basic and advanced usage
- Platform-specific notes
- Troubleshooting
- Distribution tips

## Version Strategy

### Always Install Latest

The installer always downloads the latest release:
```bash
https://github.com/RichardBray/x-dl/releases/latest/download/install.sh
```

GitHub automatically redirects `latest` to the most recent release.

### Specific Version Installation (Future Enhancement)

For users who need a specific version:
```bash
VERSION=v0.1.0
curl -fsSL https://github.com/RichardBray/x-dl/releases/download/${VERSION}/install.sh | bash
```

Not included in initial version per user request.

## Security Considerations

### 1. Checksum Verification (Future)

The installer could verify SHA256 checksums:
```bash
EXPECTED_SHA=$(curl -sSL https://github.com/.../checksums.txt | grep xld-macos-apple-silicon)
ACTUAL_SHA=$(shasum -a 256 ~/.local/bin/x-dl | awk '{print $1}')
if [ "$ACTUAL_SHA" != "$EXPECTED_SHA" ]; then
    log_error "Checksum verification failed"
    exit 4
fi
```

Not included in initial version for simplicity, but `checksums.txt` will be published with releases.

### 2. Permission Requirements

- No sudo required (installs to user-local directory)
- Creates `~/.local/bin` if missing
- Makes binary executable with `chmod +x`

### 3. Shell Script Best Practices

- `set -euo pipefail` for error handling
- Use variables for paths to avoid repetition
- Quote all variables to handle spaces
- Check if commands exist before using

## Success Criteria

- [ ] `scripts/install.sh` created and executable
- [ ] `STANDALONE_BINARIES.md` created
- [ ] `README.md` updated with Quick Install section
- [ ] GitHub release v0.1.0 created with all assets
- [ ] Installer tested on macOS ARM64
- [ ] Installer tested on macOS Intel
- [ ] Installer tested on Linux x86_64
- [ ] Tested with bash, zsh, and fish shells
- [ ] Chromium installation prompt works correctly
- [ ] PATH updates work for all supported shells
- [ ] Error handling tested and working

## Post-Implementation Notes

### Automating Future Releases

Update `release:patch/minor/major` scripts to:
1. Run `bun run build:standalone`
2. Generate checksums
3. Create GitHub release
4. Upload all assets

### CI/CD Integration (Future)

Add GitHub Actions to:
1. Build binaries for all platforms on each release
2. Generate checksums
5. Attach to release automatically
6. Test installer on multiple platforms
