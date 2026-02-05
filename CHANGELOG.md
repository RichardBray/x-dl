# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.2] - 2026-02-20

### Added
- Active progress monitoring for ffmpeg HLS downloads
- Animated spinner during HLS downloads to show activity
- Dual timeout protection: 30-second no-progress + 2-minute absolute timeout
- Better error messages for stalled or timed-out downloads

### Improved
- No more indefinite hanging on stuck ffmpeg processes
- Visual feedback during long HLS downloads
- Early failure detection for network issues

## [0.2.0] - 2026-02-02

### Added
- One-line installer for macOS and Linux: `curl -fsSL https://github.com/RichardBray/x-dl/releases/latest/download/install.sh | bash`
- Automatic checksum verification for downloaded binaries
- Platform and architecture detection (macOS ARM64, macOS Intel, Linux x86_64)
- Shell configuration automation (bash, zsh, fish)
- PATH setup automation for user-local installations

### Improved
- Enhanced security with SHA256 checksum verification
- Better error messages and user feedback during installation
- Simplified installation process with minimal user intervention
- Automatic detection and handling of different platforms and shells

### Changed
- Simplified feature list in README for clarity

## [0.1.0] - 2026-01-30

### Added
- Standalone binaries for macOS and Linux
- One-line installer script (initial version)

## [0.0.2] - 2026-01-30

### Fixed
- HLS download hanging when file already exists

## [0.0.1] - 2026-01-22

### Added
- Initial pre-release
- Video extraction from X/Twitter tweets
- Support for multiple formats (mp4, webm, gif, HLS/m3u8)
- Automatic format selection (highest quality)
- URL-only mode to get video URL without downloading
- Private tweet detection with helpful errors
- Authenticated extraction via persistent browser profile
- Progress reporting during downloads
- Headed mode for debugging
- ffmpeg auto-install when possible
- Version control with git tags and SemVer
