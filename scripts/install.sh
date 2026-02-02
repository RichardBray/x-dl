#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1" >&2
    exit "$2"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

detect_platform() {
    OS=$(uname -s)
    ARCH=$(uname -m)

    case "$OS" in
        Darwin)
            case "$ARCH" in
                arm64)
                    BINARY="xld-macos-apple-silicon"
                    ;;
                x86_64)
                    BINARY="xld-macos-intel"
                    ;;
                *)
                    log_error "Unsupported architecture: $ARCH (only arm64 and x86_64 are supported on macOS)" 1
                    ;;
            esac
            ;;
        Linux)
            case "$ARCH" in
                x86_64)
                    BINARY="xld-linux-x64"
                    ;;
                *)
                    log_error "Unsupported architecture: $ARCH (only x86_64 is supported on Linux)" 1
                    ;;
            esac
            ;;
        *)
            log_error "Unsupported operating system: $OS (only macOS and Linux are supported)" 1
            ;;
    esac

    log_info "Detected platform: $OS $ARCH"
    log_info "Binary to download: $BINARY"
}

detect_shell() {
    SHELL_NAME=$(basename "$SHELL")
    log_info "Detected shell: $SHELL_NAME"

    case "$SHELL_NAME" in
        bash)
            if [[ "$OS" == "Darwin" ]]; then
                SHELL_CONFIG="$HOME/.bash_profile"
            else
                SHELL_CONFIG="$HOME/.bashrc"
            fi
            ;;
        zsh)
            SHELL_CONFIG="$HOME/.zshrc"
            ;;
        fish)
            SHELL_CONFIG="$HOME/.config/fish/config.fish"
            ;;
        *)
            log_error "Unsupported shell: $SHELL_NAME (only bash, zsh, and fish are supported)" 1
            ;;
    esac
}

download_binary() {
    local install_dir="$HOME/.local/bin"
    local binary_path="$install_dir/x-dl"
    local download_url="https://github.com/RichardBray/x-dl/releases/latest/download/$BINARY"

    log_info "Downloading binary from GitHub releases..."

    if ! curl -fsSL "$download_url" -o "$binary_path"; then
        log_error "Failed to download binary from $download_url" 2
    fi

    log_info "Binary downloaded successfully"
}

download_checksums() {
    local checksums_url="https://github.com/RichardBray/x-dl/releases/latest/download/checksums.txt"

    log_info "Downloading checksums for verification..."

    CHECKSUMS=$(curl -fsSL "$checksums_url" 2>/dev/null || echo "")

    if [[ -z "$CHECKSUMS" ]]; then
        log_warn "Failed to download checksums. Skipping verification."
        return 1
    fi

    log_info "Checksums downloaded successfully"
    return 0
}

verify_checksum() {
    local binary_path="$HOME/.local/bin/x-dl"

    if [[ -z "$CHECKSUMS" ]]; then
        return 0
    fi

    log_info "Verifying binary integrity..."

    EXPECTED_SHA=$(echo "$CHECKSUMS" | grep "$BINARY" | awk '{print $1}')

    if [[ -z "$EXPECTED_SHA" ]]; then
        log_warn "Checksum not found for $BINARY. Skipping verification."
        return 0
    fi

    ACTUAL_SHA=$(shasum -a 256 "$binary_path" | awk '{print $1}')

    if [[ "$ACTUAL_SHA" != "$EXPECTED_SHA" ]]; then
        log_error "Checksum verification failed!" 4
        log_error "Expected: $EXPECTED_SHA" 4
        log_error "Actual:   $ACTUAL_SHA" 4
        log_error "The downloaded file may be corrupted or tampered with." 4
        rm -f "$binary_path"
        log_error "Removed corrupted file. Please try installing again." 4
        exit 4
    fi

    log_info "Checksum verified successfully"
}

verify_binary() {
    local binary_path="$HOME/.local/bin/x-dl"

    if [[ ! -f "$binary_path" ]]; then
        log_error "Binary not found at $binary_path" 3
    fi

    if [[ ! -x "$binary_path" ]]; then
        chmod +x "$binary_path"
        log_info "Made binary executable"
    fi

    if ! "$binary_path" --version &>/dev/null; then
        log_error "Binary verification failed" 4
    fi

    log_info "Binary verified successfully"
}

install_binary() {
    local install_dir="$HOME/.local/bin"

    if [[ ! -d "$install_dir" ]]; then
        mkdir -p "$install_dir"
        log_info "Created directory: $install_dir"
    fi

    if [[ ! -w "$install_dir" ]]; then
        log_error "No write permission for $install_dir" 3
    fi
}

update_path() {
    local install_dir="$HOME/.local/bin"
    local path_line='export PATH="$HOME/.local/bin:$PATH"'

    if echo "$PATH" | grep -q "$install_dir"; then
        log_info "$install_dir is already in PATH"
        return 0
    fi

    case "$SHELL_NAME" in
        fish)
            local fish_path_line="fish_add_path $install_dir"
            if [[ ! -f "$SHELL_CONFIG" ]] || ! grep -q "fish_add_path.*$install_dir" "$SHELL_CONFIG"; then
                mkdir -p "$(dirname "$SHELL_CONFIG")"
                echo "$fish_path_line" >> "$SHELL_CONFIG"
                log_info "Added $install_dir to PATH in $SHELL_CONFIG"
            else
                log_info "$install_dir already configured in $SHELL_CONFIG"
            fi
            ;;
        *)
            if [[ ! -f "$SHELL_CONFIG" ]] || ! grep -q "$path_line" "$SHELL_CONFIG"; then
                echo "" >> "$SHELL_CONFIG"
                echo "# Added by x-dl installer" >> "$SHELL_CONFIG"
                echo "$path_line" >> "$SHELL_CONFIG"
                log_info "Added $install_dir to PATH in $SHELL_CONFIG"
            else
                log_info "$install_dir already configured in $SHELL_CONFIG"
            fi
            ;;
    esac
}

prompt_chromium() {
    echo ""
    echo -e "${YELLOW}Install Playwright Chromium now (~300MB)?${NC} [y/N]: "
    read -r response < /dev/tty

    if [[ "$response" =~ ^[Yy]$ ]]; then
        log_info "Installing Playwright Chromium..."
        if ~/.local/bin/x-dl install; then
            log_info "Playwright Chromium installed successfully"
        else
            log_warn "Failed to install Playwright Chromium. You can install it later by running: x-dl install"
        fi
    else
        echo ""
        echo "You can install Playwright Chromium later by running:"
        echo "  x-dl install"
    fi
}

print_summary() {
    echo ""
    echo "========================================="
    echo "  x-dl Installation Complete!"
    echo "========================================="
    echo ""
    echo "Binary location: $HOME/.local/bin/x-dl"
    echo "Shell config: $SHELL_CONFIG"
    echo ""
    echo "Next steps:"
    echo ""
    echo "1. Reload your shell or run:"
    case "$SHELL_NAME" in
        fish)
            echo "   source $SHELL_CONFIG"
            ;;
        *)
            echo "   source $SHELL_CONFIG"
            ;;
    esac
    echo ""
    echo "2. Verify installation:"
    echo "   x-dl --help"
    echo ""
    echo "3. Install Playwright Chromium:"
    echo "   x-dl install"
    echo ""
    echo "4. Download videos from X/Twitter:"
    echo "   x-dl https://x.com/user/status/123456"
    echo ""
    echo "========================================="
    echo ""
}

main() {
    echo ""
    echo "========================================="
    echo "  x-dl Installer"
    echo "========================================="
    echo ""

    detect_platform
    detect_shell
    install_binary
    download_binary
    download_checksums
    verify_checksum
    verify_binary
    update_path
    prompt_chromium
    print_summary
}

main "$@"
