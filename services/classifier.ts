/**
 * Heuristic classifier — client-side fallback.
 * Adapted from Stash queue.ts and analyzer.ts.
 *
 * Used in two scenarios:
 * 1. Share extension: instant category hint before Gemini runs
 * 2. Gemini quota exhausted: fallback classification
 *
 * These are low-confidence guesses (0.4–0.7). Gemini overrides them.
 */

import { CATEGORIES } from '@/constants/categories';
import { matchUrlToCategory, isLikelyUrl } from '@/utils/url-patterns';
import type { Category, ContentType, ExtractedData } from '@/types/item';
import type { ClassificationResult } from '@/types/classification';

interface HeuristicInput {
  content: string;
  type: ContentType;
}

/**
 * Run heuristic classification on raw content.
 * Fast, deterministic, works offline.
 */
export function classifyHeuristic(
  input: HeuristicInput,
): ClassificationResult {
  const { content, type } = input;

  // Strategy 1: URL domain matching (highest signal)
  if (type === 'link' || isLikelyUrl(content)) {
    const urlMatch = matchUrlToCategory(content);
    if (urlMatch) {
      return buildResult(
        urlMatch.category,
        urlMatch.confidence,
        content,
        extractDataFromText(content),
      );
    }
  }

  // Strategy 2: Keyword matching against category definitions
  const keywordResult = matchByKeywords(content);
  if (keywordResult) {
    return buildResult(
      keywordResult.category,
      keywordResult.confidence,
      content,
      extractDataFromText(content),
    );
  }

  // Strategy 3: Fall back to 'other'
  return buildResult(
    'other',
    0.3,
    content,
    extractDataFromText(content),
  );
}

// ─── Keyword Matching ────────────────────────────────────────────────

interface KeywordMatch {
  category: Category;
  confidence: number;
}

function matchByKeywords(text: string): KeywordMatch | null {
  const lower = text.toLowerCase();
  let bestCategory: Category | null = null;
  let bestScore = 0;

  for (const [categoryId, def] of Object.entries(CATEGORIES)) {
    if (def.keywords.length === 0) continue;

    let hits = 0;
    for (const keyword of def.keywords) {
      if (lower.includes(keyword)) hits++;
    }

    const score = hits / def.keywords.length;
    if (score > bestScore && hits >= 2) {
      bestScore = score;
      bestCategory = categoryId as Category;
    }
  }

  if (bestCategory && bestScore > 0) {
    // Scale confidence: keyword matching is less reliable
    const confidence = Math.min(0.7, 0.4 + bestScore * 0.5);
    return { category: bestCategory, confidence };
  }

  return null;
}

// ─── Data Extraction ─────────────────────────────────────────────────

const DATE_PATTERN =
  /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})\b/g;

const PRICE_PATTERN =
  /\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g;

const EMAIL_PATTERN =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const PHONE_PATTERN =
  /(?:\+1\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;

function extractDataFromText(text: string): ExtractedData {
  const data: ExtractedData = {};

  const dates = text.match(DATE_PATTERN);
  if (dates?.length) {
    data.dates = [...new Set(dates)].slice(0, 5);
    data.urgency = estimateUrgency(dates[0]);
  }

  const prices = text.match(PRICE_PATTERN);
  if (prices?.length) {
    data.prices = prices.map((p) => ({
      amount: parseFloat(p.replace(/[$,]/g, '')),
      currency: 'USD',
    }));
  }

  const emails = text.match(EMAIL_PATTERN);
  if (emails?.length) {
    data.contacts = emails.map((e) => ({ email: e }));
  }

  const phones = text.match(PHONE_PATTERN);
  if (phones?.length) {
    const existing = data.contacts ?? [];
    phones.forEach((p) => {
      existing.push({ phone: p.trim() });
    });
    data.contacts = existing;
  }

  return data;
}

// ─── Urgency Estimation ──────────────────────────────────────────────
// Adapted from Stash deadline-extractor.ts

function estimateUrgency(
  dateStr: string,
): ExtractedData['urgency'] {
  try {
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) return 'low';

    const hoursUntil =
      (parsed.getTime() - Date.now()) / (1000 * 60 * 60);

    if (hoursUntil < 0) return 'low'; // past
    if (hoursUntil < 24) return 'critical';
    if (hoursUntil < 72) return 'high';
    if (hoursUntil < 168) return 'medium'; // 1 week
    return 'low';
  } catch (err) {
    console.warn('Failed to parse date for urgency estimation:', err);
    return 'low';
  }
}

// ─── Result Builder ──────────────────────────────────────────────────

function buildResult(
  category: Category,
  confidence: number,
  content: string,
  extractedData: ExtractedData,
): ClassificationResult {
  const title = generateTitle(content, category);
  return {
    category,
    confidence,
    title,
    description: '',
    extracted_data: extractedData,
    suggested_actions: suggestActions(category, extractedData),
    tags: [],
  };
}

function generateTitle(content: string, _category: Category): string {
  if (isLikelyUrl(content)) {
    try {
      const url = new URL(content);
      return url.hostname.replace(/^www\./, '');
    } catch (err) {
      console.warn('Failed to parse URL for title generation:', err);
      return content.slice(0, 60);
    }
  }
  // Take first line or first 60 chars
  const firstLine = content.split('\n')[0] ?? content;
  return firstLine.slice(0, 60);
}

function suggestActions(
  category: Category,
  data: ExtractedData,
): ClassificationResult['suggested_actions'] {
  const actions: ClassificationResult['suggested_actions'] = [];

  if (data.dates?.length) {
    actions.push({
      type: 'add_to_calendar',
      label: 'Add to Calendar',
      data: { date: data.dates[0] },
      priority: data.urgency === 'critical' ? 1 : 2,
    });
  }

  if (data.urgency === 'high' || data.urgency === 'critical') {
    actions.push({
      type: 'set_reminder',
      label: 'Set Reminder',
      data: { urgency: data.urgency },
      priority: 1,
    });
  }

  if (data.contacts?.length) {
    actions.push({
      type: 'save_contact',
      label: 'Save Contact',
      data: { contact: data.contacts[0] },
      priority: 3,
    });
  }

  if (category === 'learning' || category === 'entertainment') {
    actions.push({
      type: 'summarize',
      label: 'Summarize',
      data: {},
      priority: 2,
    });
  }

  if (data.prices?.length && category === 'shopping_deals') {
    actions.push({
      type: 'track_price',
      label: 'Track Price',
      data: { price: data.prices[0] },
      priority: 2,
    });
  }

  return actions.sort((a, b) => a.priority - b.priority).slice(0, 3);
}
