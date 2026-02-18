/**
 * Tests for heuristic classifier.
 */

import { describe, it, expect } from 'vitest';
import { classifyHeuristic } from '@/services/classifier';

describe('classifyHeuristic', () => {
  it('classifies YouTube URL as entertainment', () => {
    const result = classifyHeuristic({
      content: 'https://youtube.com/watch?v=abc123',
      type: 'link',
    });
    expect(result.category).toBe('entertainment');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('classifies Amazon URL as shopping', () => {
    const result = classifyHeuristic({
      content: 'https://amazon.com/dp/B09XYZ',
      type: 'link',
    });
    expect(result.category).toBe('shopping_deals');
  });

  it('classifies text with job keywords as jobs_career', () => {
    const result = classifyHeuristic({
      content: 'Software engineer job posting at Google. Apply by Friday. Salary $150k.',
      type: 'text',
    });
    expect(result.category).toBe('jobs_career');
  });

  it('classifies text with event keywords as events_plans', () => {
    const result = classifyHeuristic({
      content: 'Concert tickets for the festival this Saturday. RSVP now!',
      type: 'text',
    });
    expect(result.category).toBe('events_plans');
  });

  it('falls back to other for unrecognizable content', () => {
    const result = classifyHeuristic({
      content: 'xyzzy qwerty asdf',
      type: 'text',
    });
    expect(result.category).toBe('other');
    expect(result.confidence).toBeLessThan(0.5);
  });

  it('extracts prices from text', () => {
    const result = classifyHeuristic({
      content: 'Great deal on headphones for $49.99!',
      type: 'text',
    });
    expect(result.extracted_data.prices).toBeDefined();
    expect(result.extracted_data.prices![0].amount).toBe(49.99);
  });

  it('extracts email addresses', () => {
    const result = classifyHeuristic({
      content: 'Contact me at john@example.com for more info',
      type: 'text',
    });
    expect(result.extracted_data.contacts).toBeDefined();
    expect(result.extracted_data.contacts![0].email).toBe('john@example.com');
  });

  it('extracts dates from text', () => {
    const result = classifyHeuristic({
      content: 'Meeting scheduled for 3/15/2026 at noon',
      type: 'text',
    });
    expect(result.extracted_data.dates).toBeDefined();
    expect(result.extracted_data.dates!.length).toBeGreaterThan(0);
  });

  it('suggests add_to_calendar when dates found', () => {
    const result = classifyHeuristic({
      content: 'Party on 12/25/2026 at 7pm! RSVP to the event.',
      type: 'text',
    });
    const calendarAction = result.suggested_actions.find(
      (a) => a.type === 'add_to_calendar',
    );
    expect(calendarAction).toBeDefined();
  });

  it('suggests summarize for learning content', () => {
    const result = classifyHeuristic({
      content: 'https://arxiv.org/abs/2301.12345',
      type: 'link',
    });
    const summarizeAction = result.suggested_actions.find(
      (a) => a.type === 'summarize',
    );
    expect(summarizeAction).toBeDefined();
  });

  it('limits suggested actions to 3 max', () => {
    const result = classifyHeuristic({
      content: 'Buy concert tickets for $50 on 1/1/2026. Contact john@email.com. Visit NYC.',
      type: 'text',
    });
    expect(result.suggested_actions.length).toBeLessThanOrEqual(3);
  });

  it('always returns a valid ClassificationResult shape', () => {
    const result = classifyHeuristic({
      content: '',
      type: 'text',
    });
    expect(result).toHaveProperty('category');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('description');
    expect(result).toHaveProperty('extracted_data');
    expect(result).toHaveProperty('suggested_actions');
    expect(result).toHaveProperty('tags');
  });
});
