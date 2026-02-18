/**
 * Inbox — pending and recently classified items.
 * Includes manual "Add" button for POC (before share extension).
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  TextInput,
  Alert,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/auth';
import { useItemsStore } from '@/stores/items';
import { saveItem, triggerClassify } from '@/services/insforge';
import { getCategoryDef } from '@/constants/categories';
import { timeAgo, truncate } from '@/utils/format';
import type { Item } from '@/types/item';

export default function InboxScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { items, loading, fetchItems } = useItemsStore();
  const [showAddInput, setShowAddInput] = useState(false);
  const [addText, setAddText] = useState('');

  const inboxItems = items.filter(
    (item) => item.status !== 'archived',
  );

  const onRefresh = useCallback(() => {
    if (user) fetchItems(user.id);
  }, [user, fetchItems]);

  const handleAdd = async () => {
    if (!addText.trim() || !user) return;

    try {
      const item = await saveItem(user.id, {
        type: 'text',
        content: addText.trim(),
      });
      await triggerClassify(item.id);
      setAddText('');
      setShowAddInput(false);
    } catch (err) {
      Alert.alert('Error', 'Failed to save item. Please try again.');
    }
  };

  const renderItem = ({ item }: { item: Item }) => {
    const cat = getCategoryDef(item.category);
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
          {item.status === 'pending' && (
            <View style={styles.pendingDot} />
          )}
        </View>

        <Text style={styles.cardTitle}>
          {item.title ?? truncate(item.raw_content, 60)}
        </Text>

        {item.description ? (
          <Text style={styles.cardDescription}>
            {truncate(item.description, 120)}
          </Text>
        ) : null}

        <Text style={styles.cardMeta}>{timeAgo(item.created_at)}</Text>
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
            placeholderTextColor="#6B7280"
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
              style={styles.addButton}
            >
              <Text style={styles.addButtonText}>Save</Text>
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
            tintColor="#6366F1"
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
  container: { flex: 1, backgroundColor: '#0F0F14' },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#1A1A24',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    backgroundColor: '#F59E0B',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cardDescription: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 20,
  },
  cardMeta: { fontSize: 12, color: '#6B7280' },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: { fontSize: 28, color: '#FFF', fontWeight: '300' },
  addContainer: {
    padding: 16,
    backgroundColor: '#1A1A24',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3A',
    gap: 12,
  },
  addInput: {
    backgroundColor: '#0F0F14',
    borderRadius: 12,
    padding: 14,
    color: '#FFFFFF',
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
  addCancelText: { color: '#6B7280', fontSize: 14 },
  addButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
});
