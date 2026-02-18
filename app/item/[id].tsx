/**
 * Item detail — view classified item, extracted data, and actions.
 */

import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Alert, StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useItemsStore } from '@/stores/items';
import {
  getActionsForItem,
  updateActionStatus,
  triggerSummarize,
} from '@/services/insforge';
import { getCategoryDef } from '@/constants/categories';
import { smartDate, truncate, confidenceLabel } from '@/utils/format';
import type { Action } from '@/types/action';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const items = useItemsStore((s) => s.items);
  const { archiveItem, deleteItem, reclassify } = useItemsStore();
  const [actions, setActions] = useState<Action[]>([]);

  const item = items.find((i) => i.id === id);

  useEffect(() => {
    if (id) {
      getActionsForItem(id)
        .then(setActions)
        .catch((err) => console.error('Load actions failed:', err));
    }
  }, [id]);

  if (!item) {
    return (
      <View style={styles.container}>
        <Text style={styles.notFound}>Item not found</Text>
      </View>
    );
  }

  const cat = getCategoryDef(item.category);

  const handleApproveAction = async (action: Action) => {
    try {
      if (action.type === 'summarize') {
        await triggerSummarize(item.id, action.id);
      }
      await updateActionStatus(action.id, 'approved');
      setActions((prev) =>
        prev.map((a) =>
          a.id === action.id ? { ...a, status: 'approved' } : a,
        ),
      );
    } catch (err) {
      Alert.alert('Error', 'Failed to execute action.');
    }
  };

  const handleDismissAction = async (actionId: string) => {
    try {
      await updateActionStatus(actionId, 'dismissed');
      setActions((prev) =>
        prev.map((a) =>
          a.id === actionId ? { ...a, status: 'dismissed' } : a,
        ),
      );
    } catch (err) {
      console.error('Dismiss failed:', err);
    }
  };

  const handleArchive = () => {
    archiveItem(item.id);
    router.back();
  };

  const handleDelete = () => {
    Alert.alert('Delete', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteItem(item.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
      </View>

      {/* Category + Status */}
      <View style={styles.meta}>
        <View style={[styles.badge, { backgroundColor: cat.bgColor }]}>
          <Text style={[styles.badgeText, { color: cat.color }]}>
            {cat.label}
          </Text>
        </View>
        {item.confidence !== null && (
          <Text style={styles.confidence}>
            {confidenceLabel(item.confidence)} confidence
          </Text>
        )}
      </View>

      {/* Title + Description */}
      <Text style={styles.title}>
        {item.title ?? 'Untitled'}
      </Text>
      {item.description ? (
        <Text style={styles.description}>{item.description}</Text>
      ) : null}

      <Text style={styles.date}>{smartDate(item.created_at)}</Text>

      {/* Raw Content */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Original Content</Text>
        <Text style={styles.rawContent}>
          {truncate(item.raw_content, 500)}
        </Text>
      </View>

      {/* Extracted Data */}
      {item.extracted_data &&
        Object.keys(item.extracted_data).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Extracted Data</Text>
            {item.extracted_data.dates?.map((d, i) => (
              <Text key={`date-${i}`} style={styles.dataRow}>
                📅 {d}
              </Text>
            ))}
            {item.extracted_data.prices?.map((p, i) => (
              <Text key={`price-${i}`} style={styles.dataRow}>
                💰 ${p.amount} {p.currency}
              </Text>
            ))}
            {item.extracted_data.locations?.map((l, i) => (
              <Text key={`loc-${i}`} style={styles.dataRow}>
                📍 {l}
              </Text>
            ))}
            {item.extracted_data.urgency && (
              <Text style={styles.dataRow}>
                ⚡ Urgency: {item.extracted_data.urgency}
              </Text>
            )}
          </View>
        )}

      {/* Actions */}
      {actions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Suggested Actions</Text>
          {actions
            .filter((a) => a.status !== 'dismissed')
            .map((action) => (
              <View key={action.id} style={styles.actionCard}>
                <Text style={styles.actionLabel}>
                  {(action.action_data as { label?: string })?.label ??
                    action.type}
                </Text>
                <View style={styles.actionButtons}>
                  {action.status === 'suggested' && (
                    <>
                      <Pressable
                        style={styles.approveBtn}
                        onPress={() => handleApproveAction(action)}
                      >
                        <Text style={styles.approveBtnText}>
                          Approve
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleDismissAction(action.id)}
                      >
                        <Text style={styles.dismissText}>Dismiss</Text>
                      </Pressable>
                    </>
                  )}
                  {action.status === 'approved' && (
                    <Text style={styles.statusText}>✓ Approved</Text>
                  )}
                  {action.status === 'completed' && (
                    <Text style={styles.statusText}>✓ Done</Text>
                  )}
                </View>
              </View>
            ))}
        </View>
      )}

      {/* Danger Zone */}
      <View style={styles.dangerZone}>
        <Pressable style={styles.reclassifyBtn} onPress={() => reclassify(item.id)}>
          <Text style={styles.reclassifyText}>Re-classify</Text>
        </Pressable>
        <Pressable style={styles.archiveBtn} onPress={handleArchive}>
          <Text style={styles.archiveText}>Archive</Text>
        </Pressable>
        <Pressable onPress={handleDelete}>
          <Text style={styles.deleteText}>Delete</Text>
        </Pressable>
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F14', padding: 16 },
  header: { marginBottom: 16, paddingTop: 8 },
  back: { color: '#6366F1', fontSize: 16 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  confidence: { fontSize: 12, color: '#6B7280' },
  title: { fontSize: 22, fontWeight: '700', color: '#FFF', marginBottom: 8 },
  description: { fontSize: 15, color: '#9CA3AF', lineHeight: 22, marginBottom: 8 },
  date: { fontSize: 13, color: '#6B7280', marginBottom: 24 },
  section: { marginBottom: 24, gap: 8 },
  sectionTitle: {
    fontSize: 13, fontWeight: '600', color: '#6B7280',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  rawContent: {
    fontSize: 14, color: '#D1D5DB', lineHeight: 20,
    backgroundColor: '#1A1A24', padding: 12, borderRadius: 8,
  },
  dataRow: { fontSize: 14, color: '#D1D5DB', paddingVertical: 4 },
  actionCard: {
    backgroundColor: '#1A1A24', borderRadius: 10, padding: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  actionLabel: { fontSize: 15, color: '#FFF', fontWeight: '500' },
  actionButtons: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  approveBtn: {
    backgroundColor: '#6366F1', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 8,
  },
  approveBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  dismissText: { color: '#6B7280', fontSize: 13 },
  statusText: { color: '#10B981', fontSize: 13, fontWeight: '600' },
  dangerZone: {
    flexDirection: 'row', gap: 16, alignItems: 'center', marginTop: 8,
  },
  reclassifyBtn: {
    backgroundColor: '#1A1A24', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 8,
  },
  reclassifyText: { color: '#F59E0B', fontSize: 14 },
  archiveBtn: {
    backgroundColor: '#1A1A24', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 8,
  },
  archiveText: { color: '#6B7280', fontSize: 14 },
  deleteText: { color: '#EF4444', fontSize: 14 },
  notFound: { color: '#6B7280', fontSize: 16, textAlign: 'center', paddingTop: 80 },
});
