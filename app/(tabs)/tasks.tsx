/**
 * Tasks — pending and completed actions across all items.
 */

import { useCallback, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  Pressable,
  RefreshControl,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants/theme';
import { useAuthStore } from '@/stores/auth';
import { useActionsStore, type ActionWithItem } from '@/stores/actions';
import { getCategoryDef } from '@/constants/categories';
import { ACTION_LABELS, PLACEHOLDER_ACTIONS } from '@/constants/actions';
import { timeAgo, truncate } from '@/utils/format';
import type { Category } from '@/types/item';

export default function TasksScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const {
    loading,
    fetchActions,
    executeAndUpdate,
    dismissAction,
    getPending,
    getCompleted,
  } = useActionsStore();

  const [executingId, setExecutingId] = useState<string | null>(null);
  const pending = getPending();
  const completed = getCompleted();

  const sections = [
    ...(pending.length > 0
      ? [{ title: 'Pending', data: pending }]
      : []),
    ...(completed.length > 0
      ? [{ title: 'Completed', data: completed }]
      : []),
  ];

  const onRefresh = useCallback(() => {
    if (user) fetchActions(user.id);
  }, [user, fetchActions]);

  const handleExecute = async (action: ActionWithItem) => {
    setExecutingId(action.id);
    try {
      await executeAndUpdate(action);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to execute action.';
      Alert.alert('Action Failed', msg);
    } finally {
      setExecutingId(null);
    }
  };

  const renderItem = ({ item: action }: { item: ActionWithItem }) => {
    const cat = action.item?.category
      ? getCategoryDef(action.item.category as Category)
      : null;
    const itemTitle =
      action.item?.title ??
      truncate(action.item?.raw_content ?? '', 40);

    return (
      <Pressable
        style={styles.card}
        onPress={() => {
          if (action.item_id) {
            router.push(`/item/${action.item_id}`);
          }
        }}
      >
        <View style={styles.cardTop}>
          <Text style={styles.actionType}>
            {ACTION_LABELS[action.type] ?? action.type}
          </Text>
          {cat && (
            <View
              style={[styles.badge, { backgroundColor: cat.bgColor }]}
            >
              <Text style={[styles.badgeText, { color: cat.color }]}>
                {cat.label}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.itemTitle} numberOfLines={1}>
          {itemTitle}
        </Text>

        <Text style={styles.meta}>
          {timeAgo(action.created_at)}
        </Text>

        {action.status === 'suggested' &&
          !PLACEHOLDER_ACTIONS.has(action.type) && (
          <View style={styles.actionButtons}>
            <Pressable
              style={[
                styles.executeBtn,
                executingId === action.id && styles.executeBtnDisabled,
              ]}
              onPress={() => handleExecute(action)}
              disabled={executingId === action.id}
            >
              {executingId === action.id ? (
                <ActivityIndicator size="small" color={COLORS.textPrimary} />
              ) : (
                <Text style={styles.executeBtnText}>Execute</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => dismissAction(action.id)}
            >
              <Text style={styles.dismissBtnText}>Dismiss</Text>
            </Pressable>
          </View>
        )}
        {action.status === 'suggested' &&
          PLACEHOLDER_ACTIONS.has(action.type) && (
          <Text style={styles.comingSoonText}>Coming Soon</Text>
        )}

        {action.status === 'completed' && (
          <Text style={styles.completedText}>Done</Text>
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        keyExtractor={(action) => action.id}
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
            <Text style={styles.emptyTitle}>No tasks yet</Text>
            <Text style={styles.emptySubtitle}>
              Actions will appear here when Ada classifies your items
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  list: { padding: 16, gap: 8 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    gap: 6,
    marginBottom: 8,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionType: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
  itemTitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  meta: { fontSize: 12, color: COLORS.textMuted },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  executeBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  executeBtnText: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
  executeBtnDisabled: { opacity: 0.6 },
  dismissBtnText: { color: COLORS.textMuted, fontSize: 13 },
  comingSoonText: { color: COLORS.warning, fontSize: 13, fontWeight: '500', marginTop: 4 },
  completedText: {
    color: COLORS.success,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
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
});
