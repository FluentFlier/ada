/**
 * InsForge service layer.
 *
 * All database, auth, storage, and function calls go through this module.
 * No other file should import @insforge/sdk directly.
 *
 * Auth uses direct REST calls (the TS SDK's auth relies on browser
 * cookies/localStorage which don't exist in React Native). After auth,
 * the access token is set on the SDK client via getHttpClient().setAuthToken()
 * so database/storage/functions/realtime calls work normally.
 *
 * Token is persisted in expo-secure-store across app restarts.
 */

import { createClient } from '@insforge/sdk';
import * as SecureStore from 'expo-secure-store';
import { CONFIG } from '@/constants/config';
import type { Item } from '@/types/item';

// ─── Client Initialization ───────────────────────────────────────────

const BASE_URL = CONFIG.insforge.url;
const ANON_KEY = CONFIG.insforge.anonKey;
const TOKEN_KEY = 'insforge_access_token';

export const insforge = createClient({
  baseUrl: BASE_URL,
  anonKey: ANON_KEY,
});

/** Set token on SDK so database/storage/functions include Authorization. */
function setToken(token: string | null) {
  insforge.getHttpClient().setAuthToken(token);
}

/** Persist token to SecureStore and set on SDK. */
async function saveToken(token: string) {
  setToken(token);
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

/** Clear token from SDK and SecureStore. */
async function clearToken() {
  setToken(null);
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/** Direct POST to InsForge auth API (bypasses SDK browser dependencies). */
async function authPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();

  if (!res.ok) {
    const msg = json?.message ?? json?.error ?? `HTTP ${res.status}`;
    throw new AuthError(msg, json, res.status);
  }

  return json as T;
}

/** Direct GET to InsForge auth API. */
async function authGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const json = await res.json();

  if (!res.ok) {
    throw new AuthError(json?.message ?? `HTTP ${res.status}`, json, res.status);
  }

  return json as T;
}

// ─── Auth ────────────────────────────────────────────────────────────

interface AuthUser {
  id: string;
  email: string;
  emailVerified?: boolean;
  profile?: { name?: string; avatar_url?: string } | null;
}

interface SignUpResponse {
  accessToken: string | null;
  user?: AuthUser;
  requireEmailVerification?: boolean;
}

interface SignInResponse {
  accessToken: string;
  user: AuthUser;
}

interface VerifyResponse {
  accessToken: string;
  user: AuthUser;
}

interface ResendResponse {
  success: boolean;
  message: string;
}

export async function signUp(email: string, password: string) {
  const data = await authPost<SignUpResponse>('/api/auth/users', {
    email,
    password,
  });

  if (data.accessToken) {
    await saveToken(data.accessToken);
  }

  return data;
}

export async function signIn(email: string, password: string) {
  const data = await authPost<SignInResponse>('/api/auth/sessions', {
    email,
    password,
  });

  await saveToken(data.accessToken);
  return data;
}

export async function signOut() {
  await clearToken();
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) {
    // DEV: auto-login with test user if no token stored
    if (__DEV__) return devAutoLogin();
    return null;
  }

  try {
    const data = await authGet<AuthUser>(
      '/api/auth/profiles/current',
      token,
    );
    // Restore token on SDK for this session
    setToken(token);
    return data;
  } catch (err: unknown) {
    if (err instanceof AuthError && err.statusCode === 401) {
      console.warn('Token expired, cleared');
      await clearToken();
      return null;
    }
    // Non-401 error — try dev auto-login in dev, null in production
    console.warn('getCurrentUser failed:', err);
    if (__DEV__) return devAutoLogin();
    await clearToken();
    return null;
  }
}

/** DEV ONLY: auto-login with test user to skip auth during development. */
async function devAutoLogin(): Promise<AuthUser | null> {
  try {
    const data = await authPost<SignInResponse>('/api/auth/sessions', {
      email: 'ada.test@example.com',
      password: 'AdaTest12345',
    });
    await saveToken(data.accessToken);
    return data.user;
  } catch (err: unknown) {
    console.warn('Dev auto-login failed:', err);
    return null;
  }
}

export async function verifyEmail(email: string, otp: string) {
  const data = await authPost<VerifyResponse>('/api/auth/email/verify', {
    email,
    otp,
  });

  if (data.accessToken) {
    await saveToken(data.accessToken);
  }

  return data;
}

export async function resendVerificationEmail(email: string) {
  return authPost<ResendResponse>('/api/auth/email/send-verification', {
    email,
  });
}

// ─── Storage ─────────────────────────────────────────────────────────

export async function uploadImage(
  userId: string,
  fileUri: string,
  fileName: string,
): Promise<string> {
  // In React Native, we need to fetch the URI as a blob first
  const response = await fetch(fileUri);
  const blob = await response.blob();

  const path = `${userId}/${Date.now()}-${fileName}`;
  const { data, error } = await insforge.storage
    .from('item-images')
    .upload(path, blob);

  if (error) throw new StorageError('Failed to upload image', error);
  return data?.url ?? path;
}

// ─── Edge Functions ──────────────────────────────────────────────────

export async function triggerClassify(
  itemId: string,
  itemData?: { type: string; raw_content: string; user_id: string },
): Promise<void> {
  const { error } = await insforge.functions.invoke('classify', {
    body: { item_id: itemId, ...itemData },
  });

  if (error) {
    console.error('Classify trigger failed:', error);
    // Don't throw — classification failure is recoverable
  }
}

export async function triggerSummarize(
  itemId: string,
  actionId: string,
): Promise<void> {
  const { error } = await insforge.functions.invoke('summarize', {
    body: { item_id: itemId, action_id: actionId },
  });

  if (error) throw new FunctionError('Summarize failed', error);
}

// ─── Realtime ────────────────────────────────────────────────────────

const MAX_RECONNECT_DELAY_MS = 30_000;
const INITIAL_RECONNECT_DELAY_MS = 1_000;

export function subscribeToItems(
  userId: string,
  onUpdate: (item: Item) => void,
) {
  const channel = `items:${userId}`;
  let cancelled = false;
  let retryCount = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const handleUpdate = (payload: unknown) => {
    const msg = payload as { item?: Item };
    if (msg.item) {
      onUpdate(msg.item);
    }
  };

  function connect() {
    if (cancelled) return;

    insforge.realtime.connect().then(() => {
      if (cancelled) return;
      retryCount = 0;
      insforge.realtime.subscribe(channel);
      insforge.realtime.on('item_updated', handleUpdate);
      insforge.realtime.on('item_created', handleUpdate);
    }).catch((err: unknown) => {
      if (cancelled) return;
      console.warn('Realtime connect failed, will retry:', err);
      scheduleReconnect();
    });
  }

  function scheduleReconnect() {
    if (cancelled) return;
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY_MS * 2 ** retryCount,
      MAX_RECONNECT_DELAY_MS,
    );
    retryCount++;
    retryTimer = setTimeout(connect, delay);
  }

  connect();

  return {
    unsubscribe: () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      insforge.realtime.off('item_updated', handleUpdate);
      insforge.realtime.off('item_created', handleUpdate);
      insforge.realtime.unsubscribe(channel);
    },
  };
}

/** Disconnect all realtime subscriptions (call on signOut). */
export function disconnectRealtime() {
  try {
    insforge.realtime.disconnect?.();
  } catch (err: unknown) {
    console.warn('Realtime disconnect failed (may not be connected):', err);
  }
}

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

// ─── Re-exports ─────────────────────────────────────────────────────
// Item CRUD and action queries live in insforge-queries.ts but are
// re-exported here so callers keep importing from '@/services/insforge'.
export * from './insforge-queries';
