/**
 * Core item types for Ada.
 * An "item" is anything the user shares into Ada.
 */

export type ContentType = 'link' | 'text' | 'image' | 'screenshot';

export type Category =
  | 'events_plans'
  | 'food_dining'
  | 'shopping_deals'
  | 'travel'
  | 'jobs_career'
  | 'learning'
  | 'entertainment'
  | 'health_fitness'
  | 'finance'
  | 'social'
  | 'inspiration'
  | 'other';

export const CATEGORY_VALUES: Category[] = [
  'events_plans', 'food_dining', 'shopping_deals', 'travel',
  'jobs_career', 'learning', 'entertainment', 'health_fitness',
  'finance', 'social', 'inspiration', 'other',
];

export type ItemStatus = 'pending' | 'classified' | 'archived';

export interface ExtractedData {
  dates?: string[];
  prices?: Array<{ amount: number; currency: string }>;
  locations?: string[];
  contacts?: Array<{ name?: string; email?: string; phone?: string }>;
  urls?: string[];
  deadline?: string;
  deadlineDescription?: string;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  ocrText?: string;
}

export interface SuggestedAction {
  type: string;
  label: string;
  data: Record<string, unknown>;
  priority: number;
}

export interface Item {
  id: string;
  user_id: string;
  type: ContentType;
  raw_content: string;
  title: string | null;
  description: string | null;
  category: Category | null;
  extracted_data: ExtractedData | null;
  suggested_actions: SuggestedAction[] | null;
  confidence: number | null;
  status: ItemStatus;
  source_app: string | null;
  is_starred: boolean;
  user_note: string | null;
  created_at: string;
  updated_at: string;
}

/** What comes in from the share extension before classification. */
export interface RawCapture {
  type: ContentType;
  content: string;
  source_app?: string;
  user_input?: string;
}
