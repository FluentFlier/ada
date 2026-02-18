/**
 * Search — client-side search across all item fields.
 */

import { useState } from 'react';
import {
  View, Text, TextInput, FlatList, Pressable, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useItemsStore } from '@/stores/items';
import { getCategoryDef } from '@/constants/categories';
import { truncate, timeAgo } from '@/utils/format';
import type { Item } from '@/types/item';

export default function SearchScreen() {
  const router = useRouter();
  const searchItems = useItemsStore((s) => s.searchItems);
  const [query, setQuery] = useState('');

  const results = query.length >= 2 ? searchItems(query) : [];

  const renderItem = ({ item }: { item: Item }) => {
    const cat = getCategoryDef(item.category);
    return (
      <Pressable
        style={styles.card}
        onPress={() => router.push(`/item/${item.id}`)}
      >
        <Text style={styles.title} numberOfLines={1}>
          {item.title ?? truncate(item.raw_content, 50)}
        </Text>
        <Text style={styles.meta}>
          {cat.label} · {timeAgo(item.created_at)}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          placeholder="Search your items..."
          placeholderTextColor="#6B7280"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
      </View>

      <FlatList
        data={results}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          query.length >= 2 ? (
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
  container: { flex: 1, backgroundColor: '#0F0F14' },
  searchBar: { padding: 16 },
  input: {
    backgroundColor: '#1A1A24',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#FFF',
    borderWidth: 1,
    borderColor: '#2A2A3A',
  },
  list: { paddingHorizontal: 16, gap: 8 },
  card: {
    backgroundColor: '#1A1A24',
    borderRadius: 10,
    padding: 14,
    gap: 4,
  },
  title: { fontSize: 15, fontWeight: '500', color: '#FFF' },
  meta: { fontSize: 12, color: '#6B7280' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: '#6B7280' },
});
