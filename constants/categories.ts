/**
 * Category definitions — single source of truth for all category metadata.
 * Used by: UI badges, heuristic classifier, library filters, item detail.
 */

import type { Category } from '@/types/item';

export interface CategoryDefinition {
  id: Category;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  keywords: string[];
}

export const CATEGORIES: Record<Category, CategoryDefinition> = {
  events_plans: {
    id: 'events_plans',
    label: 'Events & Plans',
    icon: 'calendar',
    color: '#8B5CF6',
    bgColor: '#8B5CF620',
    keywords: [
      'event', 'concert', 'meetup', 'party', 'rsvp',
      'tickets', 'festival', 'conference', 'wedding', 'birthday',
    ],
  },
  food_dining: {
    id: 'food_dining',
    label: 'Food & Dining',
    icon: 'restaurant',
    color: '#F59E0B',
    bgColor: '#F59E0B20',
    keywords: [
      'restaurant', 'recipe', 'food', 'dining', 'menu',
      'reservation', 'cooking', 'brunch', 'dinner', 'cafe',
    ],
  },
  shopping_deals: {
    id: 'shopping_deals',
    label: 'Shopping & Deals',
    icon: 'cart',
    color: '#10B981',
    bgColor: '#10B98120',
    keywords: [
      'buy', 'sale', 'discount', 'coupon', 'deal',
      'price', 'amazon', 'shop', 'order', 'product', 'wishlist',
    ],
  },
  travel: {
    id: 'travel',
    label: 'Travel',
    icon: 'airplane',
    color: '#3B82F6',
    bgColor: '#3B82F620',
    keywords: [
      'flight', 'hotel', 'airbnb', 'travel', 'trip',
      'booking', 'destination', 'itinerary', 'vacation', 'airport',
    ],
  },
  jobs_career: {
    id: 'jobs_career',
    label: 'Jobs & Career',
    icon: 'briefcase',
    color: '#6366F1',
    bgColor: '#6366F120',
    keywords: [
      'job', 'career', 'hiring', 'apply', 'resume',
      'linkedin', 'intern', 'salary', 'interview', 'recruiter',
    ],
  },
  learning: {
    id: 'learning',
    label: 'Learning',
    icon: 'school',
    color: '#14B8A6',
    bgColor: '#14B8A620',
    keywords: [
      'tutorial', 'course', 'learn', 'article', 'paper',
      'study', 'documentation', 'guide', 'how-to', 'arxiv',
    ],
  },
  entertainment: {
    id: 'entertainment',
    label: 'Entertainment',
    icon: 'film',
    color: '#EC4899',
    bgColor: '#EC489920',
    keywords: [
      'movie', 'show', 'netflix', 'spotify', 'music',
      'game', 'book', 'podcast', 'youtube', 'watch',
    ],
  },
  health_fitness: {
    id: 'health_fitness',
    label: 'Health & Fitness',
    icon: 'fitness',
    color: '#EF4444',
    bgColor: '#EF444420',
    keywords: [
      'workout', 'gym', 'health', 'fitness', 'exercise',
      'diet', 'yoga', 'doctor', 'appointment', 'wellness',
    ],
  },
  finance: {
    id: 'finance',
    label: 'Finance',
    icon: 'wallet',
    color: '#059669',
    bgColor: '#05966920',
    keywords: [
      'bill', 'payment', 'invest', 'stock', 'budget',
      'bank', 'receipt', 'tax', 'insurance', 'crypto',
    ],
  },
  social: {
    id: 'social',
    label: 'Social',
    icon: 'people',
    color: '#F97316',
    bgColor: '#F9731620',
    keywords: [
      'contact', 'profile', 'friend', 'message',
      'instagram', 'twitter', 'social', 'dm',
    ],
  },
  inspiration: {
    id: 'inspiration',
    label: 'Inspiration',
    icon: 'sparkles',
    color: '#A855F7',
    bgColor: '#A855F720',
    keywords: [
      'quote', 'idea', 'design', 'inspiration',
      'mood', 'aesthetic', 'creative', 'art', 'pinterest',
    ],
  },
  other: {
    id: 'other',
    label: 'Other',
    icon: 'folder',
    color: '#6B7280',
    bgColor: '#6B728020',
    keywords: [],
  },
};

export const CATEGORY_LIST = Object.values(CATEGORIES);

export function getCategoryDef(
  category: Category | null | undefined,
): CategoryDefinition {
  if (category && category in CATEGORIES) {
    return CATEGORIES[category];
  }
  return CATEGORIES.other;
}
