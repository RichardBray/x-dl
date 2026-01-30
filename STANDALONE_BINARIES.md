# Standalone Binaries

This guide covers building, installing, and using the standalone `x-dl` binaries for macOS and Linux.

## Quick Install

The easiest way to install `x-dl` is using the one-line installer:

```bash
curl -fsSL https://github.com/RichardBray/x-dl/releases/latest/download/install.sh | bash
```

This will:
- Detect your platform (macOS/Linux) and architecture (ARM64/x86_64)
- Download the appropriate binary
- Install to `~/.local/bin/x-dl`
- Add to PATH if needed
- Prompt to install Playwright Chromium

After installation, reload your shell:

```bash
source ~/.bashrc   # or ~/.zshrc
```

## Building Binaries

### Prerequisites

- Bun runtime
- Git repository clone

### Build Commands

Build for your current platform:

```bash
bun run build:standalone
```

The binaries will be created in the `dist/` directory.

### Available Binaries

| Binary Name | Platform | Architecture |
|-------------|----------|--------------|
| `xld-macos-apple-silicon` | macOS | ARM64 (M1/M2/M3) |
| `xld-macos-intel` | macOS | x86_64 (Intel) |
| `xld-linux-x64` | Linux | x86_64 |

## Manual Installation

### macOS

1. Download the appropriate binary for your Mac:
   - **Apple Silicon (M1/M2/M3):** `xld-macos-apple-silicon`
   - **Intel:** `xld-macos-intel`

2. Make it executable and move to your PATH:
   ```bash
   chmod +x xld-macos-apple-silicon
   sudo mv xld-macos-apple-silicon /usr/local/bin/x-dl
   ```

### Linux

1. Download the Linux binary:
   - **x86_64:** `xld-linux-x64`

2. Make it executable and move to your PATH:
   ```bash
   chmod +x xld-linux-x64
   sudo mv xld-linux-x64 /usr/local/bin/x-dl
   ```

## Installation to User Directory (No sudo)

If you prefer not to use `sudo`, you can install to a user-local directory:

```bash
mkdir -p ~/.local/bin
chmod +x xld-macos-apple-silicon  # or xld-linux-x64
mv xld-macos-apple-silicon ~/.local/bin/x-dl
```

Then add to your PATH by adding this line to your shell config:

**bash:**
```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

**zsh:**
```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**fish:**
```bash
fish_add_path ~/.local/bin
```

## Usage

### Basic Usage

Download a video from X/Twitter:

```bash
x-dl https://x.com/user/status/123456
```

Download with custom output directory:

```bash
x-dl https://x.com/user/status/123456 -o ~/Downloads/
```

Download multiple videos:

```bash
x-dl https://x.com/user/status/123456 https://x.com/user/status/789012
```

### Playwright Chromium

The standalone binary requires Playwright Chromium to render videos. Install it with:

```bash
x-dl install
```

This downloads the Chromium browser (~300MB) to your user data directory.

### Advanced Usage

See the main README for more advanced usage examples and options.

## Platform-Specific Notes

### macOS

- Apple Silicon and Intel binaries are provided separately
- macOS 11 (Big Sur) or later is required
- Gatekeeper may show a warning on first run - allow the app in System Preferences if needed

### Linux

- x86_64 (amd64) binaries are provided
- Most modern distributions are supported
- Chromium is downloaded to `~/.cache/ms-playwright/`

## Troubleshooting

### "x-dl: command not found"

This means the binary isn't in your PATH. Verify installation:

```bash
which x-dl
```

If it returns nothing, check where you installed the binary and ensure it's in your PATH.

### "Chromium not found"

Run the install command:

```bash
x-dl install
```

### Permission denied

Make the binary executable:

```bash
chmod +x /path/to/x-dl
```

### Download fails

Check that you have internet access and that the GitHub releases are accessible. The binary is downloaded from:

```
https://github.com/RichardBray/x-dl/releases/latest/download/
```

### "Unsupported platform" error

The installer only supports:
- macOS (ARM64 and x86_64)
- Linux (x86_64)

If you're on a different platform, you'll need to build from source or use the Node.js version.

## Verifying Installation

Check that `x-dl` is working:

```bash
x-dl --version
x-dl --help
```

## Checksums

Each release includes a `checksums.txt` file with SHA256 checksums for verification:

```bash
shasum -a 256 x-dl
# Compare output with checksums.txt
```

## Updating

To update to the latest version, simply run the installer again:

```bash
curl -fsSL https://github.com/RichardBray/x-dl/releases/latest/download/install.sh | bash
```

This will overwrite the existing binary with the latest version.

## Uninstalling

Remove the binary:

```bash
rm ~/.local/bin/x-dl  # if installed with the installer
rm /usr/local/bin/x-dl  # if installed system-wide
```

Remove Playwright Chromium:

```bash
rm -rf ~/.cache/ms-playwright/  # Linux
rm -rf ~/Library/Caches/ms-playwright/  # macOS
```

Remove from your shell config by editing `~/.bashrc`, `~/.zshrc`, or `~/.config/fish/config.fish`.

## Distribution Tips

If you're redistributing the binaries:

1. Include all platform-specific binaries
2. Include the installer script
3. Include checksums.txt
4. Maintain consistent versioning
5. Test on all supported platforms before release

## Security

- The installer downloads binaries from official GitHub releases
- Binaries are not signed (work in progress)
- Always verify checksums if security is critical
- Report any security issues via GitHub Security Advisories

## Support

For issues or questions:
- Open an issue on GitHub
- Check the main README for additional documentation
- Review existing issues for solutions
