/**
 * Inbox — pending and recently classified items.
 * Includes manual "Add" button for POC (before share extension).
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  TextInput,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/theme';
import { useAuthStore } from '@/stores/auth';
import { useItemsStore } from '@/stores/items';
import { useActionsStore } from '@/stores/actions';
import { saveItem, triggerClassify } from '@/services/insforge';
import { getCategoryDef } from '@/constants/categories';
import { isLikelyUrl } from '@/utils/url-patterns';
import { timeAgo, truncate } from '@/utils/format';
import { ACTION_LABELS_SHORT, PLACEHOLDER_ACTIONS } from '@/constants/actions';
import type { ContentType, Item } from '@/types/item';

export default function InboxScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { items, loading, fetchItems, prependItem } = useItemsStore();
  const reclassify = useItemsStore((s) => s.reclassify);
  const [showAddInput, setShowAddInput] = useState(false);
  const [addText, setAddText] = useState('');
  const [saving, setSaving] = useState(false);
  const [, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { toggleStar } = useItemsStore();

  const hasPending = items.some((i) => i.status === 'pending');

  useEffect(() => {
    if (hasPending) {
      tickRef.current = setInterval(() => setTick((t) => t + 1), 10_000);
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [hasPending]);

  const inboxItems = useMemo(
    () =>
      items
        .filter((item) => item.status !== 'archived')
        .sort((a, b) => {
          if (a.is_starred !== b.is_starred) return a.is_starred ? -1 : 1;
          return (
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
          );
        }),
    [items],
  );

  const onRefresh = useCallback(() => {
    if (user) fetchItems(user.id);
  }, [user, fetchItems]);

  const handleAdd = async () => {
    if (!addText.trim() || !user || saving) return;

    const trimmed = addText.trim();
    const type: ContentType = isLikelyUrl(trimmed) ? 'link' : 'text';

    setSaving(true);
    try {
      const item = await saveItem(user.id, { type, content: trimmed });
      prependItem(item);
      triggerClassify(item.id).catch(() => {});
      setAddText('');
      setShowAddInput(false);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('Save Failed', msg);
    } finally {
      setSaving(false);
    }
  };

  const { getForItem, executeAndUpdate, dismissAction } =
    useActionsStore();

  const renderItem = ({ item }: { item: Item }) => {
    const cat = getCategoryDef(item.category);
    const itemActions = getForItem(item.id).filter(
      (a) =>
        a.status === 'suggested' && !PLACEHOLDER_ACTIONS.has(a.type),
    );

    return (
      <Pressable
        style={styles.card}
        onPress={() => router.push(`/item/${item.id}`)}
      >
        <View style={styles.cardHeader}>
          <View
            style={[styles.badge, { backgroundColor: cat.bgColor }]}
          >
            <Text style={[styles.badgeText, { color: cat.color }]}>
              {cat.label}
            </Text>
          </View>
          <View style={styles.cardHeaderRight}>
            {item.status === 'pending' && (
              <View style={styles.pendingDot} />
            )}
            <Pressable
              onPress={() => toggleStar(item.id)}
              hitSlop={8}
            >
              <Ionicons
                name={item.is_starred ? 'star' : 'star-outline'}
                size={18}
                color={item.is_starred ? COLORS.warning : COLORS.textMuted}
              />
            </Pressable>
          </View>
        </View>

        <Text style={styles.cardTitle}>
          {item.title ?? truncate(item.raw_content, 60)}
        </Text>

        {item.description ? (
          <Text style={styles.cardDescription}>
            {truncate(item.description, 120)}
          </Text>
        ) : null}

        {itemActions.length > 0 && (
          <View style={styles.actionPills}>
            {itemActions.slice(0, 2).map((action) => (
              <View key={action.id} style={styles.actionPillRow}>
                <Pressable
                  style={styles.actionPill}
                  onPress={() => {
                    executeAndUpdate(action).catch((err: unknown) => {
                      const msg =
                        err instanceof Error
                          ? err.message
                          : 'Action failed.';
                      Alert.alert('Action Failed', msg);
                    });
                  }}
                >
                  <Text style={styles.actionPillText}>
                    {ACTION_LABELS_SHORT[action.type] ?? action.type}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => dismissAction(action.id)}
                  hitSlop={8}
                >
                  <Text style={styles.actionDismiss}>x</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.cardMeta}>{timeAgo(item.created_at)}</Text>
          {item.status === 'pending' &&
            Date.now() - new Date(item.created_at).getTime() > 30_000 && (
              <View style={styles.retryRow}>
                <Text style={styles.classifyingText}>Classifying...</Text>
                <Pressable
                  style={styles.retryButton}
                  onPress={() => reclassify(item.id)}
                  hitSlop={8}
                >
                  <Ionicons name="refresh" size={12} color={COLORS.warning} />
                </Pressable>
              </View>
            )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {showAddInput && (
        <View style={styles.addContainer}>
          <TextInput
            style={styles.addInput}
            placeholder="Paste a URL or type anything..."
            placeholderTextColor={COLORS.textMuted}
            value={addText}
            onChangeText={setAddText}
            autoFocus
            multiline
          />
          <View style={styles.addActions}>
            <Pressable
              onPress={() => setShowAddInput(false)}
              style={styles.addCancel}
            >
              <Text style={styles.addCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleAdd}
              style={[styles.addButton, saving && styles.addButtonDisabled]}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={COLORS.textPrimary} />
              ) : (
                <Text style={styles.addButtonText}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}

      <FlatList
        data={inboxItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Your inbox is empty</Text>
            <Text style={styles.emptySubtitle}>
              Tap + to add something, or share from any app
            </Text>
          </View>
        }
      />

      {!showAddInput && (
        <Pressable
          style={styles.fab}
          onPress={() => setShowAddInput(true)}
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.warning,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  cardDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardMeta: { fontSize: 12, color: COLORS.textMuted },
  retryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  classifyingText: {
    fontSize: 12,
    color: COLORS.warning,
  },
  retryButton: {
    padding: 4,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: { fontSize: 28, color: COLORS.textPrimary, fontWeight: '300' },
  actionPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  actionPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionPill: {
    backgroundColor: COLORS.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  actionPillText: {
    fontSize: 12,
    color: COLORS.primaryLight,
    fontWeight: '600',
  },
  actionDismiss: {
    fontSize: 12,
    color: COLORS.textMuted,
    paddingHorizontal: 2,
  },
  addContainer: {
    padding: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceElevated,
    gap: 12,
  },
  addInput: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 14,
    color: COLORS.textPrimary,
    fontSize: 15,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  addActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  addCancel: { padding: 10 },
  addCancelText: { color: COLORS.textMuted, fontSize: 14 },
  addButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonDisabled: { opacity: 0.6 },
  addButtonText: { color: COLORS.textPrimary, fontWeight: '600', fontSize: 14 },
});
