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
import { Ionicons } from '@expo/vector-icons';
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
  const { items, loading, fetchItems } = useItemsStore();
  const [showAddInput, setShowAddInput] = useState(false);
  const [addText, setAddText] = useState('');

  const { toggleStar } = useItemsStore();

  const inboxItems = items
    .filter((item) => item.status !== 'archived')
    .sort((a, b) => {
      if (a.is_starred && !b.is_starred) return -1;
      if (!a.is_starred && b.is_starred) return 1;
      return 0;
    });

  const onRefresh = useCallback(() => {
    if (user) fetchItems(user.id);
  }, [user, fetchItems]);

  const handleAdd = async () => {
    if (!addText.trim() || !user) return;

    const trimmed = addText.trim();
    const type: ContentType = isLikelyUrl(trimmed) ? 'link' : 'text';

    try {
      const item = await saveItem(user.id, { type, content: trimmed });
      triggerClassify(item.id).catch(() => {});
      setAddText('');
      setShowAddInput(false);
      fetchItems(user.id);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('Save Failed', msg);
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
                color={item.is_starred ? '#F59E0B' : '#6B7280'}
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
    backgroundColor: '#2A2A3A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  actionPillText: {
    fontSize: 12,
    color: '#818CF8',
    fontWeight: '600',
  },
  actionDismiss: {
    fontSize: 12,
    color: '#6B7280',
    paddingHorizontal: 2,
  },
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
