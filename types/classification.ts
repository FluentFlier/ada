/**
 * Types for Gemini classification responses.
 */

import type { Category, ExtractedData, SuggestedAction } from './item';

export interface ClassificationResult {
  category: Category;
  confidence: number;
  title: string;
  description: string;
  extracted_data: ExtractedData;
  suggested_actions: SuggestedAction[];
  tags: string[];
}

export interface ClassifyRequest {
  item_id: string;
  raw_content: string;
  type: string;
  image_base64?: string;
}

export interface ClassifyResponse {
  success: boolean;
  classification?: ClassificationResult;
  error?: string;
  fallback?: boolean;
}
