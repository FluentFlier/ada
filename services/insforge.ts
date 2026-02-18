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
import type { Item, RawCapture, ItemStatus, Category } from '@/types/item';
import type { Action, ActionStatus } from '@/types/action';

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
    throw new AuthError(msg, json);
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
    throw new AuthError(json?.message ?? `HTTP ${res.status}`, json);
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
  } catch {
    // Token expired — try dev auto-login in dev, null in production
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
  } catch {
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

// ─── Items ───────────────────────────────────────────────────────────

export async function saveItem(
  userId: string,
  capture: RawCapture,
): Promise<Item> {
  const { data, error } = await insforge.database
    .from('items')
    .insert({
      user_id: userId,
      type: capture.type,
      raw_content: capture.content,
      status: 'pending' as ItemStatus,
      source_app: capture.source_app ?? null,
    })
    .select();

  if (error) throw new DatabaseError('Failed to save item', error);
  if (!data || data.length === 0) {
    throw new DatabaseError('Insert returned no data');
  }
  return data[0] as Item;
}

export async function getItems(
  userId: string,
  options: {
    status?: ItemStatus;
    category?: Category;
    limit?: number;
  } = {},
): Promise<Item[]> {
  let query = insforge.database
    .from('items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (options.status) {
    query = query.eq('status', options.status);
  }
  if (options.category) {
    query = query.eq('category', options.category);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw new DatabaseError('Failed to fetch items', error);
  return (data ?? []) as Item[];
}

export async function getItemById(
  itemId: string,
): Promise<Item | null> {
  const { data, error } = await insforge.database
    .from('items')
    .select('*')
    .eq('id', itemId)
    .single();

  if (error) throw new DatabaseError('Failed to fetch item', error);
  return data as Item | null;
}

export async function updateItem(
  itemId: string,
  updates: Partial<Item>,
): Promise<Item> {
  const { data, error } = await insforge.database
    .from('items')
    .update(updates)
    .eq('id', itemId)
    .select();

  if (error) throw new DatabaseError('Failed to update item', error);
  if (!data || data.length === 0) {
    throw new DatabaseError('Update returned no data');
  }
  return data[0] as Item;
}

export async function archiveItem(itemId: string): Promise<void> {
  await updateItem(itemId, { status: 'archived' });
}

export async function deleteItem(itemId: string): Promise<void> {
  const { error } = await insforge.database
    .from('items')
    .delete()
    .eq('id', itemId);

  if (error) throw new DatabaseError('Failed to delete item', error);
}

export async function toggleStar(
  itemId: string,
  starred: boolean,
): Promise<Item> {
  const { data, error } = await insforge.database
    .from('items')
    .update({ is_starred: starred })
    .eq('id', itemId)
    .select();

  if (error) throw new DatabaseError('Failed to toggle star', error);
  if (!data || data.length === 0) {
    throw new DatabaseError('Toggle star returned no data');
  }
  return data[0] as Item;
}

export async function updateUserNote(
  itemId: string,
  note: string | null,
): Promise<Item> {
  const { data, error } = await insforge.database
    .from('items')
    .update({ user_note: note })
    .eq('id', itemId)
    .select();

  if (error) throw new DatabaseError('Failed to update note', error);
  if (!data || data.length === 0) {
    throw new DatabaseError('Update note returned no data');
  }
  return data[0] as Item;
}

// ─── Actions ─────────────────────────────────────────────────────────

export async function getActionsForItem(
  itemId: string,
): Promise<Action[]> {
  const { data, error } = await insforge.database
    .from('actions')
    .select('*')
    .eq('item_id', itemId)
    .order('created_at', { ascending: true });

  if (error) throw new DatabaseError('Failed to fetch actions', error);
  return (data ?? []) as Action[];
}

export async function getActionsForUser(
  userId: string,
  options: { status?: ActionStatus } = {},
): Promise<(Action & { item?: Item })[]> {
  let query = insforge.database
    .from('actions')
    .select('*, item:items(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (options.status) {
    query = query.eq('status', options.status);
  }

  const { data, error } = await query;
  if (error) throw new DatabaseError('Failed to fetch user actions', error);
  return (data ?? []) as (Action & { item?: Item })[];
}

export async function updateActionStatus(
  actionId: string,
  status: ActionStatus,
  result?: Record<string, unknown>,
): Promise<void> {
  const updates: Record<string, unknown> = { status };
  if (status === 'completed') {
    updates.completed_at = new Date().toISOString();
  }
  if (result) {
    updates.result = result;
  }

  const { error } = await insforge.database
    .from('actions')
    .update(updates)
    .eq('id', actionId);

  if (error) throw new DatabaseError('Failed to update action', error);
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

export async function triggerClassify(itemId: string): Promise<void> {
  const { error } = await insforge.functions.invoke('classify', {
    body: { item_id: itemId },
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

export function subscribeToItems(
  userId: string,
  onUpdate: (item: Item) => void,
) {
  const channel = `items:${userId}`;

  const handleUpdate = (payload: unknown) => {
    const msg = payload as { item?: Item };
    if (msg.item) {
      onUpdate(msg.item);
    }
  };

  insforge.realtime.connect().then(() => {
    insforge.realtime.subscribe(channel);
    insforge.realtime.on('item_updated', handleUpdate);
    insforge.realtime.on('item_created', handleUpdate);
  }).catch((err: unknown) => {
    console.error('Realtime connect failed:', err);
  });

  return {
    unsubscribe: () => {
      insforge.realtime.off('item_updated', handleUpdate);
      insforge.realtime.off('item_created', handleUpdate);
      insforge.realtime.unsubscribe(channel);
    },
  };
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

export class AuthError extends AdaError {}
export class DatabaseError extends AdaError {}
export class StorageError extends AdaError {}
export class FunctionError extends AdaError {}
