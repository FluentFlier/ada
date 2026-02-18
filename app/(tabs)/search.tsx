/**
 * Search — client-side search across all item fields.
 */

import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, Pressable, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants/theme';
import { useItemsStore } from '@/stores/items';
import { getCategoryDef } from '@/constants/categories';
import { truncate, timeAgo } from '@/utils/format';
import type { Item } from '@/types/item';

export default function SearchScreen() {
  const router = useRouter();
  const searchItems = useItemsStore((s) => s.searchItems);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const results = debouncedQuery.length >= 2
    ? searchItems(debouncedQuery)
    : [];

  const renderItem = ({ item }: { item: Item }) => {
    const cat = getCategoryDef(item.category);
    return (
      <Pressable
        style={styles.card}
        onPress={() => router.push(`/item/${item.id}`)}
      >
        <View style={styles.cardRow}>
          <View style={styles.cardContent}>
            <Text style={styles.title} numberOfLines={1}>
              {item.title ?? truncate(item.raw_content, 50)}
            </Text>
            <Text style={styles.meta}>
              {cat.label} · {timeAgo(item.created_at)}
            </Text>
          </View>
          {item.is_starred && (
            <Ionicons name="star" size={16} color={COLORS.warning} />
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          placeholder="Search your items..."
          placeholderTextColor={COLORS.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        data={results}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          debouncedQuery.length >= 2 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No results found</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                Type at least 2 characters to search
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  searchBar: { padding: 16 },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.surfaceElevated,
  },
  list: { paddingHorizontal: 16, gap: 8 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 14,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardContent: { flex: 1, gap: 4 },
  title: { fontSize: 15, fontWeight: '500', color: COLORS.textPrimary },
  meta: { fontSize: 12, color: COLORS.textMuted },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: COLORS.textMuted },
});
