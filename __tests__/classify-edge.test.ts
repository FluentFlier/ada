/**
 * Tests for classify edge function logic.
 * Tests AI response parsing, content preparation, and error handling.
 * Does NOT test the Deno HTTP handler directly (requires Deno runtime).
 */

import { describe, it, expect } from 'vitest';
import { CATEGORY_VALUES } from '@/types/item';
import type { Category } from '@/types/item';

// ─── Extracted Logic Under Test ─────────────────────────────────────
//
// These functions mirror the parsing/validation logic inside
// functions/classify/index.ts so we can test them without importing
// the Deno-specific edge function handler.

const VALID_CATEGORIES = new Set<string>(CATEGORY_VALUES);

const VALID_ACTION_TYPES = new Set([
  'add_to_calendar',
  'set_reminder',
  'summarize',
]);

interface ClassificationResult {
  category: string;
  confidence: number;
  title: string;
  description: string;
  extracted_data: Record<string, unknown>;
  suggested_actions: Array<{
    type: string;
    label: string;
    data: Record<string, unknown>;
    priority: number;
  }>;
}

/**
 * Mirrors the AI response parsing logic from classifyWithAI in
 * functions/classify/index.ts:
 * 1. Strip markdown code fences
 * 2. JSON.parse
 * 3. On failure, return fallback with category 'other', confidence 0.3
 */
function parseClassificationResponse(
  responseText: string,
  contentPreview: string = '',
): ClassificationResult {
  try {
    const cleaned = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    return JSON.parse(cleaned) as ClassificationResult;
  } catch {
    return {
      category: 'other',
      confidence: 0.3,
      title: contentPreview.slice(0, 60),
      description: '',
      extracted_data: {},
      suggested_actions: [],
    };
  }
}

/**
 * Validates and normalises the category field.
 * Unknown or empty values fall back to 'other'.
 */
function validateCategory(category: string | undefined | null): Category {
  if (category && VALID_CATEGORIES.has(category)) {
    return category as Category;
  }
  return 'other';
}

/**
 * Clamps confidence to [0, 1]. Non-numeric values fall back to 0.3.
 */
function clampConfidence(value: unknown): number {
  const num = Number(value);
  if (Number.isNaN(num)) return 0.3;
  return Math.min(1, Math.max(0, num));
}

/**
 * Filters out actions whose type is not in the allowed set.
 */
function filterValidActions(
  actions: Array<{ type: string; label: string; data: Record<string, unknown> }>,
): Array<{ type: string; label: string; data: Record<string, unknown> }> {
  return actions.filter((a) => VALID_ACTION_TYPES.has(a.type));
}

// ─── Factory ────────────────────────────────────────────────────────

function makeClassificationJSON(
  overrides: Partial<ClassificationResult> = {},
): string {
  const base: ClassificationResult = {
    category: 'learning',
    confidence: 0.92,
    title: 'Introduction to TypeScript',
    description: 'A comprehensive tutorial on TypeScript basics.',
    extracted_data: {
      dates: [],
      locations: [],
    },
    suggested_actions: [
      {
        type: 'summarize',
        label: 'Summarize article',
        data: {},
        priority: 1,
      },
    ],
    ...overrides,
  };
  return JSON.stringify(base);
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('classify edge function logic', () => {
  // ─── AI Response JSON Parsing ─────────────────────────────────

  describe('parseClassificationResponse', () => {
    it('parses valid JSON response with all fields', () => {
      const json = makeClassificationJSON();
      const result = parseClassificationResponse(json);

      expect(result.category).toBe('learning');
      expect(result.confidence).toBe(0.92);
      expect(result.title).toBe('Introduction to TypeScript');
      expect(result.description).toBe(
        'A comprehensive tutorial on TypeScript basics.',
      );
      expect(result.extracted_data).toEqual({ dates: [], locations: [] });
      expect(result.suggested_actions).toHaveLength(1);
    });

    it('strips markdown code fences before parsing', () => {
      const json = makeClassificationJSON({ category: 'entertainment' });
      const wrapped = '```json\n' + json + '\n```';
      const result = parseClassificationResponse(wrapped);

      expect(result.category).toBe('entertainment');
      expect(result.confidence).toBe(0.92);
    });

    it('strips code fences without json language tag', () => {
      const json = makeClassificationJSON({ category: 'finance' });
      const wrapped = '```\n' + json + '\n```';
      const result = parseClassificationResponse(wrapped);

      expect(result.category).toBe('finance');
    });

    it('returns fallback on malformed JSON', () => {
      const result = parseClassificationResponse(
        '{ not valid json !!!',
        'Some raw content here',
      );

      expect(result.category).toBe('other');
      expect(result.confidence).toBe(0.3);
      expect(result.title).toBe('Some raw content here');
      expect(result.description).toBe('');
      expect(result.extracted_data).toEqual({});
      expect(result.suggested_actions).toEqual([]);
    });

    it('returns fallback on empty response', () => {
      const result = parseClassificationResponse('', 'fallback title');

      expect(result.category).toBe('other');
      expect(result.confidence).toBe(0.3);
      expect(result.title).toBe('fallback title');
    });

    it('truncates fallback title to 60 characters', () => {
      const longContent = 'A'.repeat(100);
      const result = parseClassificationResponse('bad json', longContent);

      expect(result.title).toHaveLength(60);
    });

    it('handles response with missing optional fields', () => {
      const minimalJSON = JSON.stringify({
        category: 'travel',
        confidence: 0.8,
        title: 'Flight to NYC',
        description: 'A flight booking confirmation.',
      });
      const result = parseClassificationResponse(minimalJSON);

      expect(result.category).toBe('travel');
      expect(result.title).toBe('Flight to NYC');
      // Missing fields come through as undefined (not filled by parser)
      expect(result.suggested_actions).toBeUndefined();
      expect(result.extracted_data).toBeUndefined();
    });

    it('handles response with extra whitespace around fences', () => {
      const json = makeClassificationJSON({ category: 'social' });
      const wrapped = '  ```json\n' + json + '\n```  ';
      const result = parseClassificationResponse(wrapped);

      expect(result.category).toBe('social');
    });

    it('handles nested code fences in response text', () => {
      const json = makeClassificationJSON({ category: 'learning' });
      const wrapped = '```json\n```json\n' + json + '\n```\n```';
      // Double fences get stripped, leaving raw JSON
      const result = parseClassificationResponse(wrapped);

      expect(result.category).toBe('learning');
    });
  });

  // ─── Category Validation ──────────────────────────────────────

  describe('validateCategory', () => {
    it('accepts all 12 valid category IDs', () => {
      const validCategories: Category[] = [
        'events_plans', 'food_dining', 'shopping_deals', 'travel',
        'jobs_career', 'learning', 'entertainment', 'health_fitness',
        'finance', 'social', 'inspiration', 'other',
      ];

      for (const cat of validCategories) {
        expect(validateCategory(cat)).toBe(cat);
      }
    });

    it('falls back to other for unknown category string', () => {
      expect(validateCategory('unknown_category')).toBe('other');
    });

    it('falls back to other for empty string', () => {
      expect(validateCategory('')).toBe('other');
    });

    it('falls back to other for null', () => {
      expect(validateCategory(null)).toBe('other');
    });

    it('falls back to other for undefined', () => {
      expect(validateCategory(undefined)).toBe('other');
    });

    it('is case-sensitive and rejects wrong casing', () => {
      expect(validateCategory('Events_Plans')).toBe('other');
      expect(validateCategory('TRAVEL')).toBe('other');
    });
  });

  // ─── Confidence Clamping ──────────────────────────────────────

  describe('clampConfidence', () => {
    it('returns value within valid range unchanged', () => {
      expect(clampConfidence(0.85)).toBe(0.85);
    });

    it('clamps value of exactly 0 to 0', () => {
      expect(clampConfidence(0)).toBe(0);
    });

    it('clamps value of exactly 1 to 1', () => {
      expect(clampConfidence(1)).toBe(1);
    });

    it('clamps confidence greater than 1 to 1.0', () => {
      expect(clampConfidence(1.5)).toBe(1.0);
      expect(clampConfidence(99)).toBe(1.0);
    });

    it('clamps confidence less than 0 to 0.0', () => {
      expect(clampConfidence(-0.5)).toBe(0.0);
      expect(clampConfidence(-100)).toBe(0.0);
    });

    it('falls back to 0.3 for non-numeric string', () => {
      expect(clampConfidence('high')).toBe(0.3);
    });

    it('falls back to 0.3 for undefined', () => {
      expect(clampConfidence(undefined)).toBe(0.3);
    });

    it('treats null as 0 since Number(null) is 0', () => {
      // Number(null) === 0, which is a valid confidence value
      expect(clampConfidence(null)).toBe(0);
    });

    it('falls back to 0.3 for NaN', () => {
      expect(clampConfidence(NaN)).toBe(0.3);
    });

    it('accepts numeric string and parses it', () => {
      expect(clampConfidence('0.75')).toBe(0.75);
    });
  });

  // ─── Action Data Validation ───────────────────────────────────

  describe('filterValidActions', () => {
    it('accepts valid add_to_calendar action', () => {
      const actions = [
        {
          type: 'add_to_calendar',
          label: 'Add team meeting to calendar',
          data: {
            title: 'Team meeting',
            start_time: '2026-03-01T10:00:00Z',
            end_time: '2026-03-01T11:00:00Z',
            location: 'Room 3B',
          },
        },
      ];

      const result = filterValidActions(actions);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('add_to_calendar');
      expect(result[0].data.start_time).toBe('2026-03-01T10:00:00Z');
    });

    it('accepts valid set_reminder action', () => {
      const actions = [
        {
          type: 'set_reminder',
          label: 'Remind about deadline',
          data: {
            message: 'Application deadline tomorrow',
            remind_at: '2026-03-01T08:00:00Z',
            urgency: 'high',
          },
        },
      ];

      const result = filterValidActions(actions);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('set_reminder');
      expect(result[0].data.remind_at).toBe('2026-03-01T08:00:00Z');
    });

    it('accepts valid summarize action', () => {
      const actions = [
        {
          type: 'summarize',
          label: 'Summarize article',
          data: {},
        },
      ];

      const result = filterValidActions(actions);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('summarize');
    });

    it('filters out actions with unknown types', () => {
      const actions = [
        { type: 'summarize', label: 'Summarize', data: {} },
        { type: 'send_email', label: 'Send email', data: {} },
        { type: 'order_pizza', label: 'Order pizza', data: {} },
      ];

      const result = filterValidActions(actions);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('summarize');
    });

    it('returns empty array when all actions have unknown types', () => {
      const actions = [
        { type: 'play_music', label: 'Play', data: {} },
        { type: 'deploy_server', label: 'Deploy', data: {} },
      ];

      const result = filterValidActions(actions);
      expect(result).toEqual([]);
    });

    it('returns empty array for empty input', () => {
      expect(filterValidActions([])).toEqual([]);
    });

    it('preserves multiple valid actions', () => {
      const actions = [
        {
          type: 'add_to_calendar',
          label: 'Add event',
          data: { title: 'Concert', start_time: '2026-04-01T20:00:00Z' },
        },
        {
          type: 'set_reminder',
          label: 'Remind me',
          data: { message: 'Buy tickets', remind_at: '2026-03-25T09:00:00Z' },
        },
        {
          type: 'summarize',
          label: 'Summarize details',
          data: {},
        },
      ];

      const result = filterValidActions(actions);
      expect(result).toHaveLength(3);
    });

    it('does not mutate the original array', () => {
      const actions = [
        { type: 'summarize', label: 'Keep', data: {} },
        { type: 'invalid_type', label: 'Remove', data: {} },
      ];
      const original = [...actions];

      filterValidActions(actions);
      expect(actions).toEqual(original);
    });
  });

  // ─── End-to-End Parsing Flow ──────────────────────────────────

  describe('full classification parse and validate flow', () => {
    it('parses, validates category, clamps confidence, and filters actions', () => {
      const aiResponse = JSON.stringify({
        category: 'events_plans',
        confidence: 1.2,
        title: 'Annual company retreat',
        description: 'A team-building retreat scheduled for next month.',
        extracted_data: {
          dates: ['2026-04-15'],
          locations: ['Lake Tahoe'],
        },
        suggested_actions: [
          {
            type: 'add_to_calendar',
            label: 'Add retreat to calendar',
            data: { title: 'Company Retreat', start_time: '2026-04-15T09:00:00Z' },
            priority: 1,
          },
          {
            type: 'launch_rocket',
            label: 'Should be filtered',
            data: {},
            priority: 3,
          },
        ],
      });

      const parsed = parseClassificationResponse(aiResponse);
      const category = validateCategory(parsed.category);
      const confidence = clampConfidence(parsed.confidence);
      const actions = filterValidActions(parsed.suggested_actions);

      expect(category).toBe('events_plans');
      expect(confidence).toBe(1.0);
      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('add_to_calendar');
    });

    it('produces safe defaults for completely broken AI response', () => {
      const parsed = parseClassificationResponse(
        'I am not JSON at all',
        'https://example.com/some-page',
      );
      const category = validateCategory(parsed.category);
      const confidence = clampConfidence(parsed.confidence);
      const actions = filterValidActions(parsed.suggested_actions);

      expect(category).toBe('other');
      expect(confidence).toBe(0.3);
      expect(actions).toEqual([]);
      expect(parsed.title).toBe('https://example.com/some-page');
    });

    it('handles AI response with code fences and invalid category', () => {
      const json = JSON.stringify({
        category: 'groceries',
        confidence: 0.65,
        title: 'Grocery list',
        description: 'Weekly grocery shopping list.',
        extracted_data: {},
        suggested_actions: [],
      });
      const wrapped = '```json\n' + json + '\n```';

      const parsed = parseClassificationResponse(wrapped);
      const category = validateCategory(parsed.category);

      expect(category).toBe('other');
      expect(parsed.title).toBe('Grocery list');
    });
  });
});
