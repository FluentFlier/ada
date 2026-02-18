/**
 * Share extension content processor.
 *
 * Takes raw shared content, determines type, runs heuristic classification,
 * saves to InsForge, and triggers async Gemini classification.
 *
 * Must complete in <2 seconds for share extension UX.
 */

import {
  saveItem,
  uploadImage,
  updateItem,
  triggerClassify,
} from './insforge';
import { classifyHeuristic } from './classifier';
import { isLikelyUrl } from '@/utils/url-patterns';
import { CONFIG } from '@/constants/config';
import type { ContentType, RawCapture, Item } from '@/types/item';
import type { ClassificationResult } from '@/types/classification';

interface ShareInput {
  text?: string;
  url?: string;
  imageUri?: string;
  sourceApp?: string;
}

interface ShareResult {
  item: Item;
  heuristicHint: ClassificationResult;
}

/**
 * Process shared content end-to-end.
 *
 * 1. Detect content type
 * 2. Run heuristic classification (instant)
 * 3. Save to InsForge
 * 4. Upload image if present
 * 5. Trigger async Gemini classification
 */
export async function processSharedContent(
  userId: string,
  input: ShareInput,
): Promise<ShareResult> {
  let { type, content } = detectContentType(input);

  // ── Input validation ──────────────────────────────────────────────
  // Strip null bytes and control characters (keep newlines \n, tabs \t, \r)
  content = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  // Truncate excessively long text (share extension has 120MB memory limit)
  const MAX_CONTENT_LENGTH = 50_000;
  if (content.length > MAX_CONTENT_LENGTH) {
    console.warn(
      `Shared content truncated from ${content.length} to ${MAX_CONTENT_LENGTH} chars`,
    );
    content = content.slice(0, MAX_CONTENT_LENGTH);
  }

  // Validate URLs — fall back to text if malformed
  if (type === 'link') {
    try {
      new URL(content);
    } catch (_urlErr: unknown) {
      console.warn('Invalid URL shared, treating as text:', content.slice(0, 100));
      type = 'text' as ContentType;
    }
  }

  // Instant heuristic — gives user feedback in share extension
  const heuristicHint = classifyHeuristic({ content, type });

  const capture: RawCapture = {
    type,
    content,
    source_app: input.sourceApp,
  };

  // Save to database
  const item = await saveItem(userId, capture);

  // If image, upload first so edge function can download from storage
  if (input.imageUri) {
    const fileName = `share-${Date.now()}.jpg`;
    try {
      const storagePath = await uploadImage(
        userId,
        input.imageUri,
        fileName,
      );
      // Update raw_content to storage path so classify can find it
      await updateItem(item.id, { raw_content: storagePath });
    } catch (err) {
      console.error('Image upload failed (non-fatal):', err);
    }
  }

  // Fire and forget — don't wait for classification
  triggerClassify(item.id).catch((err: unknown) => {
    console.warn('triggerClassify fire-and-forget failed:', err);
  });

  return { item, heuristicHint };
}

/**
 * Determine content type from share input.
 */
function detectContentType(
  input: ShareInput,
): { type: ContentType; content: string } {
  if (input.url) {
    return { type: 'link', content: input.url };
  }

  if (input.imageUri) {
    return {
      type: 'image',
      content: input.imageUri,
    };
  }

  if (input.text) {
    if (isLikelyUrl(input.text.trim())) {
      return { type: 'link', content: input.text.trim() };
    }

    const trimmed = input.text.slice(0, CONFIG.shareExtension.maxTextLength);
    return { type: 'text', content: trimmed };
  }

  return { type: 'text', content: '' };
}
