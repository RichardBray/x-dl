import { describe, it, expect } from 'bun:test';

describe('clip time format validation', () => {
  const valid = /^\d{2}:\d{2}$/;

  it('accepts valid MM:SS', () => {
    expect(valid.test('00:30')).toBe(true);
    expect(valid.test('01:30')).toBe(true);
    expect(valid.test('59:59')).toBe(true);
  });

  it('rejects invalid formats', () => {
    expect(valid.test('1:30')).toBe(false);
    expect(valid.test('90')).toBe(false);
    expect(valid.test('00:00:30')).toBe(false);
    expect(valid.test('1:3')).toBe(false);
  });
});
