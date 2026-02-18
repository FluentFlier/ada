/**
 * Settings — account info, item stats, sign out.
 */

import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/auth';
import { useItemsStore } from '@/stores/items';
import { CONFIG } from '@/constants/config';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut, loading, error } = useAuthStore();
  const items = useItemsStore((s) => s.items);

  const totalItems = items.length;
  const classifiedItems = items.filter(
    (i) => i.status === 'classified',
  ).length;
  const archivedItems = items.filter(
    (i) => i.status === 'archived',
  ).length;

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email ?? '---'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Stats</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Total Items</Text>
          <Text style={styles.value}>{totalItems}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Classified</Text>
          <Text style={styles.value}>{classifiedItems}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Archived</Text>
          <Text style={styles.value}>{archivedItems}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Version</Text>
          <Text style={styles.value}>{CONFIG.app.version}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Backend</Text>
          <Text style={styles.value}>InsForge</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Help</Text>
        <Pressable
          style={styles.row}
          onPress={() => router.push('/setup-guide')}
        >
          <Text style={styles.label}>How to Share</Text>
          <Text style={styles.value}>→</Text>
        </Pressable>
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}

      <Pressable
        style={[styles.signOut, loading && styles.disabled]}
        onPress={handleSignOut}
        disabled={loading}
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F14', padding: 16 },
  section: { gap: 12, marginBottom: 32 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A24',
    padding: 14,
    borderRadius: 10,
  },
  label: { fontSize: 15, color: '#FFF' },
  value: { fontSize: 15, color: '#9CA3AF' },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  signOut: {
    backgroundColor: '#1A1A24',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabled: { opacity: 0.5 },
  signOutText: { color: '#EF4444', fontSize: 16, fontWeight: '600' },
});
