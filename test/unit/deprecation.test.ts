import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

describe('Deprecation Notice Tests', () => {

  describe('Static Analysis - JSDoc Comments', () => {
    it('should have @deprecated comment on isPrivateTweet function', async () => {
      const utilsFile = await Bun.file('./src/utils.ts').text();
      expect(utilsFile).toContain('@deprecated');
      expect(utilsFile).toContain('isPrivateTweet');
      expect(utilsFile).toContain('ALPHA');
    });

    it('should have @deprecated comment on PROTECTED_ACCOUNT enum', async () => {
      const typesFile = await Bun.file('./src/types.ts').text();
      expect(typesFile).toContain('@deprecated');
      expect(typesFile).toContain('PROTECTED_ACCOUNT');
      expect(typesFile).toContain('ALPHA');
    });

    it('should have @deprecated comment on verifyAuth method', async () => {
      const extractorFile = await Bun.file('./src/extractor.ts').text();
      expect(extractorFile).toContain('@deprecated');
      expect(extractorFile).toContain('verifyAuth');
      expect(extractorFile).toContain('ALPHA');
    });
  });

  describe('Runtime - Console Warnings', () => {
    let originalWarn: typeof console.warn;
    const warnings: string[] = [];

    beforeEach(() => {
      originalWarn = console.warn;
      warnings.length = 0;
      console.warn = (...args: any[]) => {
        warnings.push(args.join(' '));
      };
    });

    afterEach(() => {
      console.warn = originalWarn;
    });

    it('should log warning when isPrivateTweet is called', async () => {
      const { isPrivateTweet } = await import('../../src/utils.ts');
      isPrivateTweet('<html></html>');

      const hasWarning = warnings.some(w =>
        w.includes('DEPRECATED') && w.includes('isPrivateTweet')
      );
      expect(hasWarning).toBe(true);
    });

    it('should log warning mentioning experimental/alpha status', async () => {
      const { isPrivateTweet } = await import('../../src/utils.ts');
      isPrivateTweet('<html></html>');

      const hasAlphaWarning = warnings.some(w =>
        w.includes('experimental') || w.includes('alpha')
      );
      expect(hasAlphaWarning).toBe(true);
    });
  });

  describe('CLI - Flag Deprecation Warnings', () => {
    it('should show deprecation warning when using --login flag', async () => {
      const process = Bun.spawn(
        ['bun', 'run', './src/index.ts', '--login', '--help'],
        {
          stdout: 'pipe',
          stderr: 'pipe',
        }
      );

      await process.exited;
      const stdout = await new Response(process.stdout).text();

      expect(stdout).toMatch(/EXPERIMENTAL ALPHA/i);
    });

    it('should show deprecation warning when using --verify-auth flag', async () => {
      const process = Bun.spawn(
        ['bun', 'run', './src/index.ts', '--help'],
        {
          stdout: 'pipe',
          stderr: 'pipe',
        }
      );

      await process.exited;
      const stdout = await new Response(process.stdout).text();

      expect(stdout).toMatch(/EXPERIMENTAL ALPHA/i);
      expect(stdout).toMatch(/verify-auth/i);
    });
  });

  describe('Documentation - README Section', () => {
    it('should have experimental alpha section in README', async () => {
      const readme = await Bun.file('./README.md').text();
      expect(readme).toMatch(/experimental\s+alpha/i);
      expect(readme).toMatch(/alpha\s+features/i);
    });

    it('should mention private tweet features as alpha in README', async () => {
      const readme = await Bun.file('./README.md').text();
      expect(readme).toMatch(/private.*tweet/i);
      expect(readme).toMatch(/authentication/i);
    });
  });

  describe('Integration - Combined Deprecation Check', () => {
    it('should have consistent deprecation messaging across all files', async () => {
      const [utils, types, extractor, readme] = await Promise.all([
        Bun.file('./src/utils.ts').text(),
        Bun.file('./src/types.ts').text(),
        Bun.file('./src/extractor.ts').text(),
        Bun.file('./README.md').text(),
      ]);

      const allFiles = [utils, types, extractor, readme];

      allFiles.forEach(file => {
        if (file.includes('@deprecated') || file.includes('deprecated')) {
          expect(file).toMatch(/alpha|experimental/i);
        }
      });
    });
  });
});
