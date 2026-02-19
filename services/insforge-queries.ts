/**
 * InsForge query layer: item CRUD and action queries.
 *
 * Split from insforge.ts to stay under the 500-line limit.
 * All functions are re-exported from insforge.ts, so callers
 * continue importing from '@/services/insforge'.
 */

import { insforge, DatabaseError } from './insforge';
import type { Item, RawCapture, ItemStatus, Category } from '@/types/item';
import type { Action, ActionStatus } from '@/types/action';

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

export const DEFAULT_PAGE_LIMIT = 50;

export async function getItems(
  userId: string,
  options: {
    status?: ItemStatus;
    category?: Category;
    limit?: number;
    offset?: number;
  } = {},
): Promise<Item[]> {
  const limit = options.limit ?? DEFAULT_PAGE_LIMIT;
  const offset = options.offset ?? 0;

  let query = insforge.database
    .from('items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (options.status) {
    query = query.eq('status', options.status);
  }
  if (options.category) {
    query = query.eq('category', options.category);
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
  options: { status?: ActionStatus; limit?: number; offset?: number } = {},
): Promise<(Action & { item?: Item })[]> {
  const limit = options.limit ?? DEFAULT_PAGE_LIMIT;
  const offset = options.offset ?? 0;

  let query = insforge.database
    .from('actions')
    .select('*, item:items(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

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
