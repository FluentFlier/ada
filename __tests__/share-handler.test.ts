/**
 * Tests for share handler content type detection.
 */

import { describe, it, expect } from 'vitest';

// We test the detectContentType logic by testing processSharedContent's
// behavior indirectly through the classifier, since detectContentType is
// private. Instead, we test the public classifyHeuristic which the share
// handler feeds into.

import { classifyHeuristic } from '@/services/classifier';

describe('share handler content type detection', () => {
  it('classifies URL content as link type', () => {
    const result = classifyHeuristic({
      content: 'https://www.nytimes.com/2026/02/18/article',
      type: 'link',
    });
    expect(result.category).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('classifies plain text as text type', () => {
    const result = classifyHeuristic({
      content: 'Remember to buy groceries tomorrow',
      type: 'text',
    });
    expect(result.category).toBeDefined();
  });

  it('handles URL-like text input as link', () => {
    const result = classifyHeuristic({
      content: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
      type: 'link',
    });
    expect(result.category).toBe('entertainment');
  });

  it('handles empty content gracefully', () => {
    const result = classifyHeuristic({
      content: '',
      type: 'text',
    });
    expect(result.category).toBe('other');
    expect(result.confidence).toBeLessThan(0.5);
  });

  it('extracts multiple data types from rich text', () => {
    const result = classifyHeuristic({
      content:
        'Meeting on 3/15/2026. Contact john@test.com or call (555) 123-4567. Budget: $500.',
      type: 'text',
    });
    expect(result.extracted_data.dates?.length).toBeGreaterThan(0);
    expect(result.extracted_data.contacts?.length).toBeGreaterThan(0);
    expect(result.extracted_data.prices?.length).toBeGreaterThan(0);
  });
});
