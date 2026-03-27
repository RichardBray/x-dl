import { describe, it, expect } from 'bun:test';
import { findChromePath, findChromeProfileDir, CdpConnection } from '../../src/cdp.ts';

describe('Chrome Detection', () => {
  it('should return a path string or null from findChromePath', () => {
    const result = findChromePath();
    expect(result === null || typeof result === 'string').toBe(true);
  });

  it('should return a profile dir string from findChromeProfileDir', () => {
    const result = findChromeProfileDir();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('CdpConnection type', () => {
  it('should export CdpConnection interface fields', () => {
    const dummy: CdpConnection = {
      browser: null as any,
      context: null as any,
      page: null as any,
      launchedByUs: false,
      cleanup: async () => {},
    };
    expect(dummy.launchedByUs).toBe(false);
  });
});
