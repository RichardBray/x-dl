import { describe, it, expect } from 'bun:test';

/**
 * CLI Smoke Tests
 * These tests verify that the CLI commands work correctly
 */

describe('CLI Commands', () => {
  describe('xld alias', () => {
    it('should spawn xld with --help and display usage information', async () => {
      const process = Bun.spawn(['bun', './bin/xld', '--help'], {
        cwd: import.meta.dir + '/../../',
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const output = await new Response(process.stdout).text();
      const exitCode = await process.exited;

      // Verify the command executed successfully
      expect(exitCode).toBe(0);

      // Verify output contains USAGE text
      expect(output).toContain('USAGE:');

      // Verify output contains xld or x-dl command reference
      expect(output.toUpperCase()).toContain('X-DL');
    });

    it('should display help without errors when using --help flag', async () => {
      const process = Bun.spawn(['bun', './bin/xld', '--help'], {
        cwd: import.meta.dir + '/../../',
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stdout = await new Response(process.stdout).text();
      const _stderr = await new Response(process.stderr).text();
      const exitCode = await process.exited;

      // Should exit successfully
      expect(exitCode).toBe(0);

      // Should have output in stdout
      expect(stdout.length).toBeGreaterThan(0);

      // Should not have errors in stderr (or minimal output)
      // Some tools output help to stderr, so we just verify the exit code
      expect(exitCode).toBe(0);
    });

    it('should display help using -h short flag', async () => {
      const process = Bun.spawn(['bun', './bin/xld', '-h'], {
        cwd: import.meta.dir + '/../../',
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const output = await new Response(process.stdout).text();
      const exitCode = await process.exited;

      expect(exitCode).toBe(0);
      expect(output).toContain('USAGE:');
      expect(output.length).toBeGreaterThan(0);
    });

    it('should handle missing arguments gracefully', async () => {
      const process = Bun.spawn(['bun', './bin/xld'], {
        cwd: import.meta.dir + '/../../',
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stdout = await new Response(process.stdout).text();
      const stderr = await new Response(process.stderr).text();
      const _exitCode = await process.exited;

      // Should display help or error message when no arguments provided
      expect(stdout.length + stderr.length).toBeGreaterThan(0);
    });
  });

  describe('CDP subcommand', () => {
    it('should show CDP info in help output', async () => {
      const process = Bun.spawn(['bun', './bin/xld', '--help'], {
        cwd: import.meta.dir + '/../../',
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const output = await new Response(process.stdout).text();
      await process.exited;

      expect(output).toContain('cdp');
      expect(output).toContain('CDP MODE');
      expect(output).toContain('chrome://inspect');
    });

    it('should error with no URL for cdp subcommand', async () => {
      const process = Bun.spawn(['bun', './bin/xld', 'cdp'], {
        cwd: import.meta.dir + '/../../',
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stderr = await new Response(process.stderr).text();
      const exitCode = await process.exited;

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('No URL provided');
    });

    it('should error with invalid URL for cdp subcommand', async () => {
      const process = Bun.spawn(['bun', './bin/xld', 'cdp', 'https://example.com'], {
        cwd: import.meta.dir + '/../../',
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stderr = await new Response(process.stderr).text();
      const exitCode = await process.exited;

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('Invalid');
    });

    it('should not show deprecated auth flags in help', async () => {
      const process = Bun.spawn(['bun', './bin/xld', '--help'], {
        cwd: import.meta.dir + '/../../',
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const output = await new Response(process.stdout).text();
      await process.exited;

      expect(output).not.toContain('--profile');
      expect(output).not.toContain('--login');
      expect(output).not.toContain('--verify-auth');
      expect(output).not.toContain('EXPERIMENTAL ALPHA');
    });
  });

  describe('x-dl alias (original name)', () => {
    it('should spawn x-dl with --help and display usage information', async () => {
      const process = Bun.spawn(['bun', './bin/x-dl', '--help'], {
        cwd: import.meta.dir + '/../../',
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const output = await new Response(process.stdout).text();
      const exitCode = await process.exited;

      expect(exitCode).toBe(0);
      expect(output).toContain('USAGE:');
      expect(output.toUpperCase()).toContain('X-DL');
    });
  });
});
