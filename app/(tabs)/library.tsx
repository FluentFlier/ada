/**
 * Library — browse items filtered by category.
 */

import { useState } from 'react';
import {
  View, Text, FlatList, Pressable, ScrollView, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useItemsStore } from '@/stores/items';
import { CATEGORY_LIST, getCategoryDef } from '@/constants/categories';
import { truncate, timeAgo } from '@/utils/format';
import type { Category, Item } from '@/types/item';

export default function LibraryScreen() {
  const router = useRouter();
  const items = useItemsStore((s) => s.items);
  const [activeCategory, setActiveCategory] = useState<Category | null>(
    null,
  );

  const filtered = activeCategory
    ? items.filter(
        (i) => i.category === activeCategory && i.status !== 'archived',
      )
    : items.filter((i) => i.status !== 'archived');

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

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        <Pressable
          style={[styles.pill, !activeCategory && styles.pillActive]}
          onPress={() => setActiveCategory(null)}
        >
          <Text
            style={[
              styles.pillText,
              !activeCategory && styles.pillTextActive,
            ]}
          >
            All
          </Text>
        </Pressable>
        {CATEGORY_LIST.filter((c) => c.id !== 'other').map((cat) => (
          <Pressable
            key={cat.id}
            style={[
              styles.pill,
              activeCategory === cat.id && styles.pillActive,
            ]}
            onPress={() =>
              setActiveCategory(
                activeCategory === cat.id ? null : cat.id,
              )
            }
          >
            <Text
              style={[
                styles.pillText,
                activeCategory === cat.id && styles.pillTextActive,
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
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              No items in this category yet
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F14' },
  filters: { padding: 16, gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1A1A24',
  },
  pillActive: { backgroundColor: '#6366F1' },
  pillText: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  pillTextActive: { color: '#FFF' },
  list: { padding: 16, gap: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A24',
    borderRadius: 10,
    padding: 14,
    gap: 12,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  cardContent: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: '500', color: '#FFF' },
  cardMeta: { fontSize: 12, color: '#6B7280' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: '#6B7280' },
});
