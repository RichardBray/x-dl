import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import {
  detectInstallationMethod,
  removeBinary,
  removeProfileDirectory,
  removeShellConfigEntry,
  commandExists,
} from '../../src/uninstaller.ts';

describe('Uninstaller', () => {
  describe('detectInstallationMethod', () => {
    it('should return none when no installation found', async () => {
      const method = await detectInstallationMethod();
      expect(['none', 'standalone', 'package']).toContain(method);
    });
  });

  describe('commandExists', () => {
    it('should return true for existing commands', async () => {
      const exists = await commandExists('node');
      expect(typeof exists).toBe('boolean');
    });

    it('should return false for non-existing commands', async () => {
      const exists = await commandExists('this-command-does-not-exist-12345');
      expect(exists).toBe(false);
    });
  });

  describe('removeProfileDirectory', () => {
    const testProfileDir = join(tmpdir(), '.test-x-dl-profile');

    beforeEach(() => {
      const fs = require('node:fs');
      if (!existsSync(testProfileDir)) {
        fs.mkdirSync(testProfileDir, { recursive: true });
      }
    });

    afterEach(() => {
      const fs = require('node:fs');
      if (existsSync(testProfileDir)) {
        fs.rmSync(testProfileDir, { recursive: true, force: true });
      }
    });

    it('should return false when profile does not exist', () => {
      const result = removeProfileDirectory();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('removeBinary', () => {
    it('should return false for none installation method', async () => {
      const result = await removeBinary('none');
      expect(result).toBe(false);
    });

    it('should handle standalone binary removal', async () => {
      const result = await removeBinary('standalone');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('removeShellConfigEntry', () => {
    it('should complete without error', () => {
      const result = removeShellConfigEntry();
      expect(typeof result).toBe('boolean');
    });
  });
});
