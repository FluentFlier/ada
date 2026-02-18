/**
 * Item detail — view classified item, extracted data, and actions.
 * Supports executing actions: calendar, reminders, summarize.
 */

import { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Alert,
  ActivityIndicator, Linking, TextInput, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useItemsStore } from '@/stores/items';
import { useActionsStore, type ActionWithItem } from '@/stores/actions';
import { ActionError } from '@/services/actions';
import { getCategoryDef } from '@/constants/categories';
import { smartDate, truncate, confidenceLabel } from '@/utils/format';
import { isLikelyUrl } from '@/utils/url-patterns';

const ACTION_LABELS: Record<string, string> = {
  add_to_calendar: 'Add to Calendar',
  set_reminder: 'Set Reminder',
  save_contact: 'Save Contact',
  summarize: 'Summarize',
  create_note: 'Create Note',
  track_price: 'Track Price',
};

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const items = useItemsStore((s) => s.items);
  const {
    archiveItem, deleteItem, reclassify, refreshItem,
    toggleStar, updateNote,
  } = useItemsStore();
  const { getForItem, executeAndUpdate, dismissAction } =
    useActionsStore();
  const [executing, setExecuting] = useState<string | null>(null);
  const [noteText, setNoteText] = useState<string | undefined>(
    undefined,
  );

  const item = items.find((i) => i.id === id);
  const actions = id ? getForItem(id) : [];

  if (!item) {
    return (
      <View style={styles.container}>
        <Text style={styles.notFound}>Item not found</Text>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Text style={styles.back}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const cat = getCategoryDef(item.category);
  const isUrl = isLikelyUrl(item.raw_content);

  const handleExecuteAction = async (action: ActionWithItem) => {
    setExecuting(action.id);
    try {
      await executeAndUpdate(action);
      if (action.type === 'summarize' && id) {
        refreshItem(id);
      }
    } catch (err) {
      const msg =
        err instanceof ActionError
          ? err.message
          : 'Failed to execute action.';
      Alert.alert('Action Failed', msg);
    } finally {
      setExecuting(null);
    }
  };

  const handleArchive = () => {
    archiveItem(item.id);
    router.back();
  };

  const handleDelete = () => {
    Alert.alert('Delete', 'Permanently delete this item?', [
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

  const handleOpenUrl = () => {
    if (isUrl) Linking.openURL(item.raw_content);
  };

  const visibleActions = actions;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <View style={styles.headerRight}>
          <Pressable onPress={() => toggleStar(item.id)} hitSlop={8}>
            <Ionicons
              name={item.is_starred ? 'star' : 'star-outline'}
              size={22}
              color={item.is_starred ? '#F59E0B' : '#6B7280'}
            />
          </Pressable>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>
      </View>

      {/* Category + Confidence */}
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
        <Pressable onPress={isUrl ? handleOpenUrl : undefined}>
          <Text
            style={[
              styles.rawContent,
              isUrl && styles.rawContentLink,
            ]}
          >
            {truncate(item.raw_content, 500)}
          </Text>
        </Pressable>
      </View>

      {/* Extracted Data */}
      {item.extracted_data &&
        Object.keys(item.extracted_data).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Extracted Data</Text>
            {item.extracted_data.dates?.map((d, i) => (
              <View key={`date-${i}`} style={styles.dataChip}>
                <Text style={styles.dataIcon}>📅</Text>
                <Text style={styles.dataText}>{d}</Text>
              </View>
            ))}
            {item.extracted_data.contacts?.map((c, i) => (
              <View key={`contact-${i}`} style={styles.dataChip}>
                <Text style={styles.dataIcon}>👤</Text>
                <Text style={styles.dataText}>
                  {c.name ?? c.email ?? c.phone ?? 'Contact'}
                </Text>
              </View>
            ))}
            {item.extracted_data.prices?.map((p, i) => (
              <View key={`price-${i}`} style={styles.dataChip}>
                <Text style={styles.dataIcon}>💰</Text>
                <Text style={styles.dataText}>
                  {p.amount} {p.currency}
                </Text>
              </View>
            ))}
            {item.extracted_data.locations?.map((l, i) => (
              <View key={`loc-${i}`} style={styles.dataChip}>
                <Text style={styles.dataIcon}>📍</Text>
                <Text style={styles.dataText}>{l}</Text>
              </View>
            ))}
            {item.extracted_data.urgency && (
              <View style={styles.dataChip}>
                <Text style={styles.dataIcon}>⚡</Text>
                <Text style={styles.dataText}>
                  {item.extracted_data.urgency} urgency
                </Text>
              </View>
            )}
          </View>
        )}

      {/* Actions */}
      {visibleActions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          {visibleActions.map((action) => (
            <View key={action.id} style={styles.actionCard}>
              <View style={styles.actionInfo}>
                <Text style={styles.actionLabel}>
                  {ACTION_LABELS[action.type] ?? action.type}
                </Text>
                {(action.action_data as { label?: string })?.label && (
                  <Text style={styles.actionDesc}>
                    {(action.action_data as { label: string }).label}
                  </Text>
                )}
              </View>
              <View style={styles.actionButtons}>
                {action.status === 'suggested' && (
                  <>
                    <Pressable
                      style={styles.approveBtn}
                      onPress={() => handleExecuteAction(action)}
                      disabled={executing === action.id}
                    >
                      {executing === action.id ? (
                        <ActivityIndicator
                          size="small"
                          color="#FFF"
                        />
                      ) : (
                        <Text style={styles.approveBtnText}>
                          Execute
                        </Text>
                      )}
                    </Pressable>
                    <Pressable
                      onPress={() => dismissAction(action.id)}
                    >
                      <Text style={styles.dismissBtnText}>
                        Dismiss
                      </Text>
                    </Pressable>
                  </>
                )}
                {action.status === 'approved' && (
                  <Text style={styles.completedText}>
                    ✓ Approved
                  </Text>
                )}
                {action.status === 'completed' && (
                  <Text style={styles.completedText}>✓ Done</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* User Note */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Note</Text>
        <TextInput
          style={styles.noteInput}
          placeholder="Add a personal note..."
          placeholderTextColor="#6B7280"
          value={noteText ?? item.user_note ?? ''}
          onChangeText={setNoteText}
          onBlur={() => {
            const val = noteText?.trim() ?? null;
            const current = item.user_note ?? null;
            if (val !== current) {
              updateNote(item.id, val || null);
            }
          }}
          multiline
          textAlignVertical="top"
        />
      </View>

      {/* Item Actions */}
      <View style={styles.itemActions}>
        <Pressable
          style={styles.itemActionBtn}
          onPress={() => reclassify(item.id)}
        >
          <Text style={styles.reclassifyText}>Re-classify</Text>
        </Pressable>
        <Pressable style={styles.itemActionBtn} onPress={handleArchive}>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  back: { color: '#6366F1', fontSize: 16 },
  backBtn: { marginTop: 20 },
  statusPill: {
    backgroundColor: '#1A1A24',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  confidence: { fontSize: 12, color: '#6B7280' },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: '#9CA3AF',
    lineHeight: 22,
    marginBottom: 8,
  },
  date: { fontSize: 13, color: '#6B7280', marginBottom: 24 },
  section: { marginBottom: 24, gap: 8 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rawContent: {
    fontSize: 14,
    color: '#D1D5DB',
    lineHeight: 20,
    backgroundColor: '#1A1A24',
    padding: 12,
    borderRadius: 8,
  },
  rawContentLink: { color: '#818CF8' },
  dataChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1A1A24',
    padding: 10,
    borderRadius: 8,
  },
  dataIcon: { fontSize: 16 },
  dataText: { fontSize: 14, color: '#D1D5DB', flex: 1 },
  noteInput: {
    backgroundColor: '#1A1A24',
    borderRadius: 8,
    padding: 12,
    color: '#D1D5DB',
    fontSize: 14,
    lineHeight: 20,
    minHeight: 60,
  },
  actionCard: {
    backgroundColor: '#1A1A24',
    borderRadius: 10,
    padding: 14,
    gap: 8,
  },
  actionInfo: { gap: 4 },
  actionLabel: { fontSize: 15, color: '#FFF', fontWeight: '600' },
  actionDesc: { fontSize: 13, color: '#9CA3AF' },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  approveBtn: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  approveBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  dismissBtnText: { color: '#6B7280', fontSize: 13 },
  completedText: { color: '#10B981', fontSize: 13, fontWeight: '600' },
  itemActions: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  itemActionBtn: {
    backgroundColor: '#1A1A24',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  reclassifyText: { color: '#F59E0B', fontSize: 14 },
  archiveText: { color: '#6B7280', fontSize: 14 },
  deleteText: { color: '#EF4444', fontSize: 14 },
  notFound: {
    color: '#6B7280',
    fontSize: 16,
    textAlign: 'center',
    paddingTop: 80,
  },
});
