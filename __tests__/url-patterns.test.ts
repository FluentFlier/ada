/**
 * Tests for URL pattern matching.
 */

import { describe, it, expect } from 'vitest';
import {
  matchUrlToCategory,
  extractDomain,
  isLikelyUrl,
} from '@/utils/url-patterns';

describe('matchUrlToCategory', () => {
  it('returns entertainment for YouTube URLs', () => {
    const result = matchUrlToCategory('https://www.youtube.com/watch?v=abc123');
    expect(result).not.toBeNull();
    expect(result!.category).toBe('entertainment');
    expect(result!.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('returns shopping for Amazon URLs', () => {
    const result = matchUrlToCategory('https://www.amazon.com/dp/B09XYZ');
    expect(result).not.toBeNull();
    expect(result!.category).toBe('shopping_deals');
  });

  it('returns travel for Airbnb URLs', () => {
    const result = matchUrlToCategory('https://airbnb.com/rooms/12345');
    expect(result).not.toBeNull();
    expect(result!.category).toBe('travel');
    expect(result!.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('returns jobs_career for LinkedIn jobs', () => {
    const result = matchUrlToCategory('https://linkedin.com/jobs/view/12345');
    expect(result).not.toBeNull();
    expect(result!.category).toBe('jobs_career');
  });

  it('returns food_dining for OpenTable', () => {
    const result = matchUrlToCategory('https://www.opentable.com/r/some-restaurant');
    expect(result).not.toBeNull();
    expect(result!.category).toBe('food_dining');
  });

  it('returns learning for arXiv papers', () => {
    const result = matchUrlToCategory('https://arxiv.org/abs/2301.12345');
    expect(result).not.toBeNull();
    expect(result!.category).toBe('learning');
  });

  it('returns null for unknown domains', () => {
    const result = matchUrlToCategory('https://randomsite.xyz/page');
    expect(result).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(matchUrlToCategory('')).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(matchUrlToCategory(null as unknown as string)).toBeNull();
  });

  it('handles URLs with subdomains', () => {
    const result = matchUrlToCategory('https://m.youtube.com/watch?v=abc');
    expect(result).not.toBeNull();
    expect(result!.category).toBe('entertainment');
  });

  it('returns finance for Robinhood', () => {
    const result = matchUrlToCategory('https://robinhood.com/stocks/AAPL');
    expect(result).not.toBeNull();
    expect(result!.category).toBe('finance');
  });
});

describe('extractDomain', () => {
  it('removes www prefix', () => {
    expect(extractDomain('https://www.google.com/search')).toBe('google.com');
  });

  it('handles invalid URLs gracefully', () => {
    expect(extractDomain('not-a-url')).toBe('not-a-url');
  });
});

describe('isLikelyUrl', () => {
  it('detects https URLs', () => {
    expect(isLikelyUrl('https://example.com')).toBe(true);
  });

  it('detects http URLs', () => {
    expect(isLikelyUrl('http://example.com')).toBe(true);
  });

  it('detects bare domains', () => {
    expect(isLikelyUrl('example.com')).toBe(true);
  });

  it('rejects plain text', () => {
    expect(isLikelyUrl('just some text')).toBe(false);
  });

  it('rejects empty strings', () => {
    expect(isLikelyUrl('')).toBe(false);
  });

  it('rejects null/undefined', () => {
    expect(isLikelyUrl(null as unknown as string)).toBe(false);
  });
});
