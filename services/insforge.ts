/**
 * InsForge service layer.
 *
 * All database, auth, storage, and function calls go through this module.
 * No other file should import @insforge/sdk directly.
 *
 * SDK patterns verified via InsForge MCP fetch-docs (2026-02-18).
 */

import { createClient } from '@insforge/sdk';
import { CONFIG } from '@/constants/config';
import type { Item, RawCapture, ItemStatus, Category } from '@/types/item';
import type { Action, ActionStatus } from '@/types/action';

// ─── Client Initialization ───────────────────────────────────────────

export const insforge = createClient({
  baseUrl: CONFIG.insforge.url,
  anonKey: CONFIG.insforge.anonKey,
});

// ─── Auth ────────────────────────────────────────────────────────────

export async function signUp(email: string, password: string) {
  const { data, error } = await insforge.auth.signUp({ email, password });
  if (error) throw new AuthError('Sign up failed', error);
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await insforge.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new AuthError('Sign in failed', error);
  return data;
}

export async function signOut() {
  const { error } = await insforge.auth.signOut();
  if (error) throw new AuthError('Sign out failed', error);
}

export async function getCurrentUser() {
  const { data, error } = await insforge.auth.getCurrentSession();
  if (error) throw new AuthError('Get session failed', error);
  return data?.session?.user ?? null;
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
    .update({ ...updates, updated_at: new Date().toISOString() })
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

  insforge.realtime.connect().then(() => {
    insforge.realtime.subscribe(channel);
  }).catch((err: unknown) => {
    console.error('Realtime connect failed:', err);
  });

  insforge.realtime.on('item_updated', (payload: unknown) => {
    const msg = payload as { item?: Item };
    if (msg.item) {
      onUpdate(msg.item);
    }
  });

  insforge.realtime.on('item_created', (payload: unknown) => {
    const msg = payload as { item?: Item };
    if (msg.item) {
      onUpdate(msg.item);
    }
  });

  return {
    unsubscribe: () => {
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
