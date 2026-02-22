/**
 * InsForge client instance and shared error types.
 *
 * Extracted so insforge.ts and insforge-queries.ts can both import
 * without a circular dependency.
 */

import { createClient } from '@insforge/sdk';
import { CONFIG } from '@/constants/config';

const BASE_URL = CONFIG.insforge.url;
const ANON_KEY = CONFIG.insforge.anonKey;

export const insforge = createClient({
  baseUrl: BASE_URL,
  anonKey: ANON_KEY,
});

// ─── Error Types ─────────────────────────────────────────────────────

class AdaError extends Error {
  public readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.cause = cause;
  }
}

export class AuthError extends AdaError {
  public readonly statusCode: number | undefined;

  constructor(message: string, cause?: unknown, statusCode?: number) {
    super(message, cause);
    this.statusCode = statusCode;
  }
}
export class DatabaseError extends AdaError {}
export class StorageError extends AdaError {}
export class FunctionError extends AdaError {}
