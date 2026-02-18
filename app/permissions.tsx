/**
 * Permissions — request calendar access with context.
 * Part of onboarding flow after auth.
 */

import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Calendar from 'expo-calendar';
import { COLORS } from '@/constants/theme';

export default function PermissionsScreen() {
  const router = useRouter();
  const [requesting, setRequesting] = useState(false);

  const handleAllow = async () => {
    setRequesting(true);
    try {
      await Calendar.requestCalendarPermissionsAsync();
    } catch (err) {
      console.warn('Calendar permission request failed:', err);
    }
    router.replace('/setup-guide');
  };

  const handleSkip = () => {
    router.replace('/setup-guide');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="calendar-outline" size={64} color={COLORS.primary} style={styles.icon} />
        <Text style={styles.title}>Calendar Access</Text>
        <Text style={styles.subtitle}>
          Ada can create calendar events when it detects dates in your
          shared content. You can always change this in Settings.
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.button, requesting && styles.buttonDisabled]}
          onPress={handleAllow}
          disabled={requesting}
        >
          <Text style={styles.buttonText}>Allow Calendar</Text>
        </Pressable>

        <Pressable onPress={handleSkip} style={styles.skip}>
          <Text style={styles.skipText}>Maybe later</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 48,
  },
  icon: { marginBottom: 16 },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  actions: { gap: 16, alignItems: 'center' },
  button: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  skip: { marginTop: 4 },
  skipText: { color: COLORS.textMuted, fontSize: 14 },
});
