/**
 * Settings — account info, sign out.
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useAuthStore } from '@/stores/auth';
import { CONFIG } from '@/constants/config';

export default function SettingsScreen() {
  const { user, signOut, loading } = useAuthStore();

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email ?? '—'}</Text>
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

      <Pressable
        style={[styles.signOut, loading && styles.disabled]}
        onPress={signOut}
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
  signOut: {
    backgroundColor: '#1A1A24',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabled: { opacity: 0.5 },
  signOutText: { color: '#EF4444', fontSize: 16, fontWeight: '600' },
});
