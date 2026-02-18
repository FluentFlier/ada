/**
 * Tests for category definitions and getCategoryDef.
 */

import { describe, it, expect } from 'vitest';
import {
  CATEGORIES,
  CATEGORY_LIST,
  getCategoryDef,
} from '@/constants/categories';
import type { Category } from '@/types/item';

const ALL_CATEGORY_IDS: Category[] = [
  'events_plans',
  'food_dining',
  'shopping_deals',
  'travel',
  'jobs_career',
  'learning',
  'entertainment',
  'health_fitness',
  'finance',
  'social',
  'inspiration',
  'other',
];

describe('CATEGORIES', () => {
  it('contains exactly 12 categories', () => {
    expect(Object.keys(CATEGORIES)).toHaveLength(12);
  });

  it('has all expected category IDs', () => {
    for (const id of ALL_CATEGORY_IDS) {
      expect(CATEGORIES).toHaveProperty(id);
    }
  });

  it.each(ALL_CATEGORY_IDS)(
    'category "%s" has id matching its key',
    (id) => {
      expect(CATEGORIES[id].id).toBe(id);
    },
  );

  it.each(ALL_CATEGORY_IDS)(
    'category "%s" has required fields',
    (id) => {
      const cat = CATEGORIES[id];
      expect(cat.label).toBeTruthy();
      expect(cat.icon).toBeTruthy();
      expect(cat.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(cat.bgColor).toBeTruthy();
      expect(Array.isArray(cat.keywords)).toBe(true);
    },
  );

  it('all non-other categories have at least one keyword', () => {
    for (const id of ALL_CATEGORY_IDS) {
      if (id === 'other') continue;
      expect(CATEGORIES[id].keywords.length).toBeGreaterThan(0);
    }
  });

  it('other category has empty keywords', () => {
    expect(CATEGORIES.other.keywords).toEqual([]);
  });

  it('has no duplicate keywords across categories', () => {
    const seen = new Map<string, string>();
    for (const [catId, cat] of Object.entries(CATEGORIES)) {
      for (const kw of cat.keywords) {
        if (seen.has(kw)) {
          throw new Error(
            `Keyword "${kw}" duplicated in "${catId}" and "${seen.get(kw)}"`,
          );
        }
        seen.set(kw, catId);
      }
    }
  });
});

describe('CATEGORY_LIST', () => {
  it('has same length as CATEGORIES keys', () => {
    expect(CATEGORY_LIST).toHaveLength(Object.keys(CATEGORIES).length);
  });

  it('contains all category definitions', () => {
    for (const id of ALL_CATEGORY_IDS) {
      expect(CATEGORY_LIST).toContainEqual(CATEGORIES[id]);
    }
  });
});

describe('getCategoryDef', () => {
  it('returns correct definition for valid category', () => {
    expect(getCategoryDef('entertainment')).toBe(CATEGORIES.entertainment);
    expect(getCategoryDef('travel')).toBe(CATEGORIES.travel);
  });

  it('returns "other" for null category', () => {
    expect(getCategoryDef(null)).toBe(CATEGORIES.other);
  });

  it('returns "other" for undefined category', () => {
    expect(getCategoryDef(undefined)).toBe(CATEGORIES.other);
  });

  it('returns "other" for unknown category string', () => {
    expect(getCategoryDef('nonexistent' as Category)).toBe(CATEGORIES.other);
  });
});
