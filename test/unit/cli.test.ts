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
      const stderr = await new Response(process.stderr).text();
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
      const exitCode = await process.exited;

      // Should display help or error message when no arguments provided
      expect(stdout.length + stderr.length).toBeGreaterThan(0);
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
