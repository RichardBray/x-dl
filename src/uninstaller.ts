import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import readline from 'node:readline';

export interface UninstallOptions {
  all?: boolean;
  keepProfile?: boolean;
}

function getPlatform(): 'macos' | 'linux' | 'other' {
  const p = process.platform;
  if (p === 'darwin') return 'macos';
  if (p === 'linux') return 'linux';
  return 'other';
}

function which(cmd: string): string | null {
  if (typeof (Bun as any)?.which === 'function') {
    return (Bun as any).which(cmd) || null;
  }

  const { spawnSync } = require('node:child_process');
  try {
    const result = spawnSync('which', [cmd], { stdio: 'pipe' });
    return result.status === 0 ? result.stdout.toString().trim() : null;
  } catch {
    return null;
  }
}

export async function commandExists(command: string): Promise<boolean> {
  try {
    const process = Bun.spawn(['which', command], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await process.exited;
    return process.exitCode === 0;
  } catch {
    return false;
  }
}

export type InstallationMethod = 'standalone' | 'package' | 'none';

export async function detectInstallationMethod(): Promise<InstallationMethod> {
  const binaryPath = path.join(os.homedir(), '.local', 'bin', 'x-dl');
  if (fs.existsSync(binaryPath)) {
    return 'standalone';
  }

  if (await commandExists('bun')) {
    try {
      const { spawnSync } = require('node:child_process');
      const result = spawnSync('bun', ['pm', 'ls', 'x-dl'], { stdio: 'pipe' });
      if (result.status === 0 && result.stdout.toString().includes('x-dl')) {
        return 'package';
      }
    } catch {
    }
  }

  if (await commandExists('npm')) {
    try {
      const { spawnSync } = require('node:child_process');
      const result = spawnSync('npm', ['list', '-g', 'x-dl'], { stdio: 'pipe' });
      if (result.status === 0 && result.stdout.toString().includes('x-dl')) {
        return 'package';
      }
    } catch {
    }
  }

  return 'none';
}

export async function removeBinary(method: InstallationMethod): Promise<boolean> {
  if (method === 'none') {
    console.log('ℹ️  No x-dl installation found');
    return false;
  }

  console.log('🗑️  Removing x-dl binary...');

  if (method === 'standalone') {
    const binaryPath = path.join(os.homedir(), '.local', 'bin', 'x-dl');
    if (fs.existsSync(binaryPath)) {
      try {
        fs.unlinkSync(binaryPath);
        console.log('✅ Removed standalone binary from ~/.local/bin/x-dl');
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`❌ Failed to remove binary: ${message}`);
        return false;
      }
    } else {
      console.log('ℹ️  Binary already removed');
      return true;
    }
  } else if (method === 'package') {
    const bunPath = which('bun');
    const npmPath = which('npm');

    if (bunPath) {
      try {
        console.log('Running: bun remove -g x-dl');
        const { spawn } = await import('node:child_process');
        await new Promise<void>((resolve, reject) => {
          const proc = spawn('bun', ['remove', '-g', 'x-dl'], {
            stdio: 'inherit',
          });
          proc.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`bun remove failed with code ${code}`));
          });
        });
        console.log('✅ Removed package via bun');
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️  bun remove failed: ${message}, trying npm...`);
      }
    }

    if (npmPath) {
      try {
        console.log('Running: npm uninstall -g x-dl');
        const { spawn } = await import('node:child_process');
        await new Promise<void>((resolve, reject) => {
          const proc = spawn('npm', ['uninstall', '-g', 'x-dl'], {
            stdio: 'inherit',
          });
          proc.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`npm uninstall failed with code ${code}`));
          });
        });
        console.log('✅ Removed package via npm');
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`❌ npm uninstall failed: ${message}`);
        return false;
      }
    }
  }

  return false;
}

export function removeProfileDirectory(): boolean {
  const profilePath = path.join(os.homedir(), '.x-dl-profile');
  if (!fs.existsSync(profilePath)) {
    console.log('ℹ️  No profile directory found');
    return false;
  }

  try {
    fs.rmSync(profilePath, { recursive: true, force: true });
    console.log('✅ Removed profile directory ~/.x-dl-profile');
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to remove profile directory: ${message}`);
    return false;
  }
}

export async function removePlaywrightChromium(): Promise<boolean> {
  const platform = getPlatform();
  const playwrightPath = platform === 'macos'
    ? path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright')
    : path.join(os.homedir(), '.cache', 'ms-playwright');

  if (!fs.existsSync(playwrightPath)) {
    console.log('ℹ️  Playwright not installed or already removed');
    return false;
  }

  console.log('🗑️  Removing Playwright Chromium...');

  try {
    const mod = await import('playwright/lib/install');
    if (typeof mod.uninstallBrowsersForNpmInstall === 'function') {
      await mod.uninstallBrowsersForNpmInstall(['chromium']);
    } else if (typeof (mod as any).uninstall === 'function') {
      await (mod as any).uninstall(['chromium']);
    }
    console.log('✅ Uninstalled Playwright Chromium');
    return true;
  } catch {
    try {
      const entries = fs.readdirSync(playwrightPath);
      const chromiumDirs = entries.filter(entry => entry.startsWith('chromium'));
      
      for (const dir of chromiumDirs) {
        fs.rmSync(path.join(playwrightPath, dir), { recursive: true, force: true });
      }
      
      console.log(`✅ Removed ${chromiumDirs.length} Chromium directory/directories`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to remove Playwright: ${message}`);
      return false;
    }
  }
}

export function removeShellConfigEntry(): boolean {
  const home = os.homedir();
  
  const bashZshPattern = /# Added by x-dl installer\s*\nexport PATH=.*\.local\/bin.*\s*\n?/g;
  const fishPattern = /fish_add_path\s+.*\.local\/bin\s*\n?/g;

  const configFiles = [
    { path: path.join(home, '.bash_profile'), pattern: bashZshPattern },
    { path: path.join(home, '.bashrc'), pattern: bashZshPattern },
    { path: path.join(home, '.zshrc'), pattern: bashZshPattern },
    { path: path.join(home, '.config', 'fish', 'config.fish'), pattern: fishPattern },
  ];

  let modified = false;

  for (const { path: configPath, pattern } of configFiles) {
    if (!fs.existsSync(configPath)) continue;

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const newContent = content.replace(pattern, '');

      if (content !== newContent) {
        const trimmedContent = newContent.trim();
        if (trimmedContent) {
          fs.writeFileSync(configPath, trimmedContent + '\n', 'utf-8');
        } else {
          fs.unlinkSync(configPath);
        }
        console.log(`✅ Removed x-dl entry from ${configPath}`);
        modified = true;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️  Failed to update ${configPath}: ${message}`);
    }
  }

  if (!modified) {
    console.log('ℹ️  No shell config entries found');
  }

  return modified;
}

export function confirm(prompt: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(`${prompt} [y/N]: `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

export async function runUninstall(options: UninstallOptions = {}): Promise<void> {
  console.log('🗑️  x-dl Uninstaller\n');

  const method = await detectInstallationMethod();

  if (method === 'none') {
    console.log('ℹ️  No x-dl installation found');
    console.log('If you installed x-dl manually, please remove it manually.\n');
    return;
  }

  console.log(`Installation method: ${method}`);

  const removeBinaryConfirmed = await confirm('Remove x-dl binary?');
  if (removeBinaryConfirmed) {
    const binaryRemoved = await removeBinary(method);
    if (!binaryRemoved) {
      console.error('❌ Failed to remove binary');
      return;
    }
  }

  const shellConfigConfirmed = await confirm('Remove PATH entry from shell config?');
  if (shellConfigConfirmed) {
    removeShellConfigEntry();
  }

  if (!options.keepProfile) {
    const removeProfileConfirmed = await confirm('Remove profile directory (~/.x-dl-profile)?');
    if (removeProfileConfirmed) {
      removeProfileDirectory();
    }
  }

  if (options.all) {
    const removePlaywrightConfirmed = await confirm('Remove Playwright Chromium?');
    if (removePlaywrightConfirmed) {
      await removePlaywrightChromium();
    }
  }

  console.log('\n✅ Uninstall complete');
  console.log('Note: You may need to reload your shell for PATH changes to take effect.');
}
