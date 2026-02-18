/**
 * Library — browse items filtered by category.
 * Supports pull-to-refresh and category filtering.
 */

import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, ScrollView,
  RefreshControl, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants/theme';
import { useAuthStore } from '@/stores/auth';
import { useItemsStore } from '@/stores/items';
import { CATEGORY_LIST, getCategoryDef } from '@/constants/categories';
import { truncate, timeAgo } from '@/utils/format';
import type { Category, Item } from '@/types/item';

export default function LibraryScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { items, loading, fetchItems } = useItemsStore();
  const { getStarred } = useItemsStore();
  const [activeFilter, setActiveFilter] = useState<
    Category | 'starred' | null
  >(null);

  const filtered =
    activeFilter === 'starred'
      ? getStarred()
      : activeFilter
        ? items.filter(
            (i) =>
              i.category === activeFilter &&
              i.status !== 'archived',
          )
        : items.filter((i) => i.status !== 'archived');

  const classifiedCount = items.filter(
    (i) => i.status === 'classified',
  ).length;

  const onRefresh = useCallback(() => {
    if (user) fetchItems(user.id);
  }, [user, fetchItems]);

  const renderItem = ({ item }: { item: Item }) => {
    const cat = getCategoryDef(item.category);
    return (
      <Pressable
        style={styles.card}
        onPress={() => router.push(`/item/${item.id}`)}
      >
        <View
          style={[styles.dot, { backgroundColor: cat.color }]}
        />
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title ?? truncate(item.raw_content, 50)}
          </Text>
          <Text style={styles.cardMeta}>
            {cat.label} · {timeAgo(item.created_at)}
          </Text>
        </View>
      </Pressable>
    );
  };

  const emptyMessage =
    activeFilter === 'starred'
      ? 'No starred items yet'
      : activeFilter
        ? `No items in ${getCategoryDef(activeFilter).label} yet`
        : classifiedCount === 0
          ? 'Items will appear here after classification'
          : 'No items to show';

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        <Pressable
          style={[styles.pill, !activeFilter && styles.pillActive]}
          onPress={() => setActiveFilter(null)}
        >
          <Text
            style={[
              styles.pillText,
              !activeFilter && styles.pillTextActive,
            ]}
          >
            All
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.pill,
            activeFilter === 'starred' && styles.pillStarred,
          ]}
          onPress={() =>
            setActiveFilter(
              activeFilter === 'starred' ? null : 'starred',
            )
          }
        >
          <Text
            style={[
              styles.pillText,
              activeFilter === 'starred' && styles.pillTextStarred,
            ]}
          >
            Starred
          </Text>
        </Pressable>
        {CATEGORY_LIST.map((cat) => (
          <Pressable
            key={cat.id}
            style={[
              styles.pill,
              activeFilter === cat.id && styles.pillActive,
            ]}
            onPress={() =>
              setActiveFilter(
                activeFilter === cat.id ? null : cat.id,
              )
            }
          >
            <Text
              style={[
                styles.pillText,
                activeFilter === cat.id && styles.pillTextActive,
              ]}
            >
              {cat.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
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
            <Text style={styles.emptyText}>{emptyMessage}</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  filters: { padding: 16, gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
  },
  pillActive: { backgroundColor: COLORS.primary },
  pillStarred: { backgroundColor: COLORS.warning },
  pillText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  pillTextActive: { color: COLORS.textPrimary },
  pillTextStarred: { color: COLORS.textPrimary },
  list: { padding: 16, gap: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 14,
    gap: 12,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  cardContent: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: '500', color: COLORS.textPrimary },
  cardMeta: { fontSize: 12, color: COLORS.textMuted },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: COLORS.textMuted },
});
