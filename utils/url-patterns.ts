/**
 * URL → category quick-mapping.
 * Adapted from Stash analyzer.ts.
 *
 * Gives instant category hints in the share extension before Gemini runs.
 * These are heuristic guesses — Gemini classification overrides them.
 */

import type { Category } from '@/types/item';

interface PatternMatch {
  category: Category;
  confidence: number;
}

interface DomainRule {
  pattern: RegExp;
  category: Category;
  confidence: number;
}

const DOMAIN_RULES: DomainRule[] = [
  // Entertainment
  { pattern: /youtube\.com|youtu\.be/i, category: 'entertainment', confidence: 0.85 },
  { pattern: /netflix\.com/i, category: 'entertainment', confidence: 0.9 },
  { pattern: /spotify\.com|music\.apple/i, category: 'entertainment', confidence: 0.85 },
  { pattern: /imdb\.com|rottentomatoes/i, category: 'entertainment', confidence: 0.85 },
  { pattern: /twitch\.tv|soundcloud/i, category: 'entertainment', confidence: 0.8 },

  // Shopping
  { pattern: /amazon\.com|amazon\.\w{2}/i, category: 'shopping_deals', confidence: 0.85 },
  { pattern: /ebay\.com|etsy\.com/i, category: 'shopping_deals', confidence: 0.85 },
  { pattern: /shopify\.com|walmart\.com/i, category: 'shopping_deals', confidence: 0.8 },
  { pattern: /target\.com|bestbuy\.com/i, category: 'shopping_deals', confidence: 0.8 },

  // Travel
  { pattern: /airbnb\.com|booking\.com/i, category: 'travel', confidence: 0.9 },
  { pattern: /expedia\.com|kayak\.com/i, category: 'travel', confidence: 0.85 },
  { pattern: /tripadvisor\.com|hotels\.com/i, category: 'travel', confidence: 0.85 },
  { pattern: /united\.com|delta\.com|southwest\.com/i, category: 'travel', confidence: 0.9 },

  // Food
  { pattern: /yelp\.com/i, category: 'food_dining', confidence: 0.8 },
  { pattern: /doordash\.com|ubereats\.com|grubhub/i, category: 'food_dining', confidence: 0.85 },
  { pattern: /opentable\.com|resy\.com/i, category: 'food_dining', confidence: 0.9 },
  { pattern: /allrecipes\.com|epicurious/i, category: 'food_dining', confidence: 0.85 },

  // Jobs
  { pattern: /linkedin\.com\/jobs|indeed\.com/i, category: 'jobs_career', confidence: 0.9 },
  { pattern: /glassdoor\.com|lever\.co/i, category: 'jobs_career', confidence: 0.85 },
  { pattern: /greenhouse\.io|angel\.co\/jobs/i, category: 'jobs_career', confidence: 0.85 },

  // Learning
  { pattern: /arxiv\.org|scholar\.google/i, category: 'learning', confidence: 0.9 },
  { pattern: /medium\.com|dev\.to/i, category: 'learning', confidence: 0.7 },
  { pattern: /coursera\.org|udemy\.com/i, category: 'learning', confidence: 0.9 },
  { pattern: /github\.com/i, category: 'learning', confidence: 0.65 },
  { pattern: /stackoverflow\.com/i, category: 'learning', confidence: 0.75 },
  { pattern: /wikipedia\.org/i, category: 'learning', confidence: 0.7 },

  // Events
  { pattern: /eventbrite\.com|meetup\.com/i, category: 'events_plans', confidence: 0.9 },
  { pattern: /ticketmaster\.com|stubhub/i, category: 'events_plans', confidence: 0.85 },

  // Finance
  { pattern: /robinhood\.com|coinbase\.com/i, category: 'finance', confidence: 0.9 },
  { pattern: /venmo\.com|paypal\.com/i, category: 'finance', confidence: 0.8 },
  { pattern: /mint\.com|ynab\.com/i, category: 'finance', confidence: 0.85 },

  // Health
  { pattern: /myfitnesspal|strava\.com/i, category: 'health_fitness', confidence: 0.85 },
  { pattern: /webmd\.com|healthline/i, category: 'health_fitness', confidence: 0.8 },

  // Social
  { pattern: /instagram\.com|twitter\.com|x\.com/i, category: 'social', confidence: 0.6 },
  { pattern: /facebook\.com|tiktok\.com/i, category: 'social', confidence: 0.6 },

  // Inspiration
  { pattern: /pinterest\.com|dribbble\.com/i, category: 'inspiration', confidence: 0.8 },
  { pattern: /behance\.net|unsplash\.com/i, category: 'inspiration', confidence: 0.8 },
];

/**
 * Try to match a URL to a category by domain.
 * Returns null if no match (unknown domain).
 */
export function matchUrlToCategory(url: string): PatternMatch | null {
  if (!url || typeof url !== 'string') return null;

  for (const rule of DOMAIN_RULES) {
    if (rule.pattern.test(url)) {
      return { category: rule.category, confidence: rule.confidence };
    }
  }

  return null;
}

/**
 * Extract a clean domain from a URL for display.
 */
export function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch (err) {
    console.warn('Failed to extract domain from URL:', err);
    return url.slice(0, 30);
  }
}

/**
 * Detect if a string is likely a URL.
 */
export function isLikelyUrl(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  return /^https?:\/\//i.test(trimmed) || /^[a-z0-9-]+\.[a-z]{2,}/i.test(trimmed);
}
