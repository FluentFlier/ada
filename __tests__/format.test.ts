/**
 * Tests for format utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  timeAgo,
  truncate,
  cleanUrl,
  confidenceLabel,
  capitalize,
} from '@/utils/format';

describe('timeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-18T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns just now for timestamps under a minute', () => {
    expect(timeAgo('2026-02-18T11:59:30Z')).toBe('just now');
  });

  it('returns minutes for recent timestamps', () => {
    expect(timeAgo('2026-02-18T11:55:00Z')).toBe('5m ago');
  });

  it('returns hours for same-day timestamps', () => {
    expect(timeAgo('2026-02-18T09:00:00Z')).toBe('3h ago');
  });

  it('returns days for recent dates', () => {
    expect(timeAgo('2026-02-16T12:00:00Z')).toBe('2d ago');
  });

  it('returns formatted date for older timestamps', () => {
    const result = timeAgo('2026-01-01T12:00:00Z');
    expect(result).toContain('Jan');
  });
});

describe('truncate', () => {
  it('returns original string if shorter than max', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates with ellipsis', () => {
    expect(truncate('hello world foo bar', 10)).toBe('hello wor…');
  });

  it('handles empty string', () => {
    expect(truncate('', 10)).toBe('');
  });

  it('handles null/undefined', () => {
    expect(truncate(null as unknown as string, 10)).toBe('');
  });
});

describe('cleanUrl', () => {
  it('removes protocol and www', () => {
    expect(cleanUrl('https://www.example.com')).toBe('example.com');
  });

  it('includes path', () => {
    expect(cleanUrl('https://example.com/page/123')).toBe(
      'example.com/page/123',
    );
  });

  it('handles invalid URLs', () => {
    const result = cleanUrl('not-a-url');
    expect(result.length).toBeLessThanOrEqual(50);
  });
});

describe('confidenceLabel', () => {
  it('returns High for scores >= 0.85', () => {
    expect(confidenceLabel(0.9)).toBe('High');
  });

  it('returns Medium for scores 0.6-0.84', () => {
    expect(confidenceLabel(0.7)).toBe('Medium');
  });

  it('returns Low for scores < 0.6', () => {
    expect(confidenceLabel(0.3)).toBe('Low');
  });

  it('returns empty for null', () => {
    expect(confidenceLabel(null)).toBe('');
  });
});

describe('capitalize', () => {
  it('capitalizes first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
  });

  it('handles empty string', () => {
    expect(capitalize('')).toBe('');
  });
});
