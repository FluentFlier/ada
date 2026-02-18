/**
 * Tests for summarize edge function logic.
 * Tests summary response handling, truncation, action result structures,
 * and error handling patterns.
 * Does NOT test the Deno HTTP handler directly (requires Deno runtime).
 */

import { describe, it, expect } from 'vitest';

// ─── Extracted Logic Under Test ─────────────────────────────────────
//
// These functions mirror the logic in functions/summarize/index.ts.
// The edge function truncates summaries to 1000 chars for the item
// description, builds action result objects, and marks actions as
// completed or failed.

/**
 * Truncates summary to fit in the item description field.
 * Mirrors: `summary.slice(0, 1000)` in functions/summarize/index.ts line 92.
 */
function truncateSummary(summary: string, maxLength: number = 1000): string {
  return summary.slice(0, maxLength);
}

/**
 * Builds the action result object when summarization succeeds.
 * Mirrors lines 82-86 of functions/summarize/index.ts.
 */
function buildCompletedActionUpdate(summary: string): {
  status: 'completed';
  result: { summary: string };
  completed_at: string;
} {
  return {
    status: 'completed',
    result: { summary },
    completed_at: new Date().toISOString(),
  };
}

/**
 * Builds the action result object when summarization fails.
 * Mirrors lines 123-128 of functions/summarize/index.ts.
 */
function buildFailedActionUpdate(error: unknown): {
  status: 'failed';
  result: { error: string };
} {
  return {
    status: 'failed',
    result: {
      error: error instanceof Error ? error.message : 'Unknown error',
    },
  };
}

/**
 * Extracts summary text from the AI completion response.
 * Mirrors line 77: `completion.choices[0]?.message?.content ?? ''`
 */
function extractSummaryFromCompletion(
  completion: {
    choices: Array<{ message?: { content?: string | null } }>;
  } | null,
): string {
  return completion?.choices[0]?.message?.content ?? '';
}

/**
 * Validates that the request body contains required fields.
 * Mirrors lines 33-38 of functions/summarize/index.ts.
 */
function validateSummarizeRequestBody(
  body: Record<string, unknown>,
): { valid: true; item_id: string; action_id: string } | { valid: false; error: string } {
  const { item_id, action_id } = body;
  if (!item_id || !action_id) {
    return { valid: false, error: 'item_id and action_id required' };
  }
  return {
    valid: true,
    item_id: String(item_id),
    action_id: String(action_id),
  };
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('summarize edge function logic', () => {
  // ─── Summary Truncation ───────────────────────────────────────

  describe('truncateSummary', () => {
    it('truncates summary longer than 1000 chars for item description', () => {
      const longSummary = 'A'.repeat(1500);
      const result = truncateSummary(longSummary);

      expect(result).toHaveLength(1000);
    });

    it('preserves summary under 1000 chars unchanged', () => {
      const shortSummary = 'This is a brief summary of the article.';
      const result = truncateSummary(shortSummary);

      expect(result).toBe(shortSummary);
    });

    it('handles exactly 1000 char summary', () => {
      const exactSummary = 'B'.repeat(1000);
      const result = truncateSummary(exactSummary);

      expect(result).toHaveLength(1000);
      expect(result).toBe(exactSummary);
    });

    it('handles empty summary string', () => {
      const result = truncateSummary('');

      expect(result).toBe('');
    });

    it('truncates at byte boundary without concern for word breaks', () => {
      // slice(0, 1000) cuts mid-word; verify that behavior is preserved
      const words = 'word '.repeat(250); // 1250 chars
      const result = truncateSummary(words);

      expect(result).toHaveLength(1000);
    });

    it('accepts custom max length parameter', () => {
      const result = truncateSummary('Hello World', 5);

      expect(result).toBe('Hello');
    });
  });

  // ─── Action Result Structure ──────────────────────────────────

  describe('buildCompletedActionUpdate', () => {
    it('result contains summary field', () => {
      const summary = 'The article discusses three key points about AI safety.';
      const update = buildCompletedActionUpdate(summary);

      expect(update.result).toEqual({ summary });
    });

    it('action is marked as completed', () => {
      const update = buildCompletedActionUpdate('test summary');

      expect(update.status).toBe('completed');
    });

    it('completed_at is a valid ISO timestamp', () => {
      const before = new Date().toISOString();
      const update = buildCompletedActionUpdate('test');
      const after = new Date().toISOString();

      expect(update.completed_at).toBeDefined();
      // Timestamp should be between before and after
      expect(update.completed_at >= before).toBe(true);
      expect(update.completed_at <= after).toBe(true);
    });

    it('preserves empty summary in result', () => {
      const update = buildCompletedActionUpdate('');

      expect(update.result.summary).toBe('');
      expect(update.status).toBe('completed');
    });

    it('preserves long summary in result without truncation', () => {
      const longSummary = 'X'.repeat(5000);
      const update = buildCompletedActionUpdate(longSummary);

      // The action result stores the FULL summary;
      // truncation happens separately for the item description.
      expect(update.result.summary).toHaveLength(5000);
    });
  });

  // ─── Error Handling ───────────────────────────────────────────

  describe('buildFailedActionUpdate', () => {
    it('action is marked as failed with error message on Error instance', () => {
      const error = new Error('AI service unavailable');
      const update = buildFailedActionUpdate(error);

      expect(update.status).toBe('failed');
      expect(update.result.error).toBe('AI service unavailable');
    });

    it('uses Unknown error for non-Error thrown values', () => {
      const update = buildFailedActionUpdate('string error');

      expect(update.status).toBe('failed');
      expect(update.result.error).toBe('Unknown error');
    });

    it('uses Unknown error for null', () => {
      const update = buildFailedActionUpdate(null);

      expect(update.status).toBe('failed');
      expect(update.result.error).toBe('Unknown error');
    });

    it('uses Unknown error for undefined', () => {
      const update = buildFailedActionUpdate(undefined);

      expect(update.status).toBe('failed');
      expect(update.result.error).toBe('Unknown error');
    });

    it('extracts message from TypeError', () => {
      const error = new TypeError('Cannot read properties of undefined');
      const update = buildFailedActionUpdate(error);

      expect(update.result.error).toBe('Cannot read properties of undefined');
    });

    it('extracts message from custom Error subclass', () => {
      class AIGatewayError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'AIGatewayError';
        }
      }
      const error = new AIGatewayError('Rate limit exceeded');
      const update = buildFailedActionUpdate(error);

      expect(update.result.error).toBe('Rate limit exceeded');
    });
  });

  // ─── Summary Extraction from AI Completion ────────────────────

  describe('extractSummaryFromCompletion', () => {
    it('extracts content from valid completion response', () => {
      const completion = {
        choices: [
          {
            message: {
              content: 'This article covers three main topics...',
            },
          },
        ],
      };

      expect(extractSummaryFromCompletion(completion)).toBe(
        'This article covers three main topics...',
      );
    });

    it('returns empty string when content is null', () => {
      const completion = {
        choices: [{ message: { content: null } }],
      };

      expect(extractSummaryFromCompletion(completion)).toBe('');
    });

    it('returns empty string when message is undefined', () => {
      const completion = {
        choices: [{ message: undefined }],
      };

      expect(extractSummaryFromCompletion(completion)).toBe('');
    });

    it('returns empty string when choices array is empty', () => {
      const completion = { choices: [] };

      expect(extractSummaryFromCompletion(completion)).toBe('');
    });

    it('returns empty string when completion is null', () => {
      expect(extractSummaryFromCompletion(null)).toBe('');
    });
  });

  // ─── Request Body Validation ──────────────────────────────────

  describe('validateSummarizeRequestBody', () => {
    it('accepts valid body with both item_id and action_id', () => {
      const result = validateSummarizeRequestBody({
        item_id: 'item-123',
        action_id: 'action-456',
      });

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.item_id).toBe('item-123');
        expect(result.action_id).toBe('action-456');
      }
    });

    it('rejects body missing item_id', () => {
      const result = validateSummarizeRequestBody({
        action_id: 'action-456',
      });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('item_id and action_id required');
      }
    });

    it('rejects body missing action_id', () => {
      const result = validateSummarizeRequestBody({
        item_id: 'item-123',
      });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('item_id and action_id required');
      }
    });

    it('rejects empty body', () => {
      const result = validateSummarizeRequestBody({});

      expect(result.valid).toBe(false);
    });

    it('rejects body with empty string item_id', () => {
      const result = validateSummarizeRequestBody({
        item_id: '',
        action_id: 'action-1',
      });

      expect(result.valid).toBe(false);
    });

    it('rejects body with empty string action_id', () => {
      const result = validateSummarizeRequestBody({
        item_id: 'item-1',
        action_id: '',
      });

      expect(result.valid).toBe(false);
    });

    it('coerces numeric IDs to strings', () => {
      const result = validateSummarizeRequestBody({
        item_id: 42,
        action_id: 99,
      });

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.item_id).toBe('42');
        expect(result.action_id).toBe('99');
      }
    });
  });
});
