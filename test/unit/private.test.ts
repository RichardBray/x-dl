import { describe, it, expect } from 'bun:test';
import { getProfileDir } from '../../src/private.ts';

describe('Private Browser Profile', () => {
  it('should return a profile dir string from getProfileDir', () => {
    const result = getProfileDir();
    expect(typeof result).toBe('string');
    expect(result).toContain('.x-dl-chrome-profile');
  });
});
