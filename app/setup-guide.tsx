/**
 * Setup Guide — 4-step visual guide to enable iOS share sheet.
 */

import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants/theme';
import { useAuthStore } from '@/stores/auth';

interface Step {
  number: number;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    number: 1,
    title: 'Open any app',
    description: 'Find a link, image, or text you want to save.',
  },
  {
    number: 2,
    title: 'Tap the Share button',
    description:
      'Look for the share icon (box with arrow) in Safari, ' +
      'Photos, Notes, or any app.',
  },
  {
    number: 3,
    title: 'Find Ada in the list',
    description:
      'Scroll the app row. If you don\'t see Ada, tap "More" ' +
      'and enable it.',
  },
  {
    number: 4,
    title: 'Tap Ada',
    description:
      'Ada saves it instantly and classifies it in the background. ' +
      'That\'s it!',
  },
];

export default function SetupGuideScreen() {
  const router = useRouter();
  const completeSetup = useAuthStore((s) => s.completeSetup);
  const [completing, setCompleting] = useState(false);

  const handleDone = async () => {
    setCompleting(true);
    await completeSetup();
    router.replace('/');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.heading}>How to Share with Ada</Text>
      <Text style={styles.subheading}>
        Use the iOS Share Sheet to send anything to Ada
      </Text>

      <View style={styles.steps}>
        {STEPS.map((step) => (
          <View key={step.number} style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{step.number}</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDesc}>{step.description}</Text>
            </View>
          </View>
        ))}
      </View>

      <Pressable
        style={[styles.button, completing && styles.buttonDisabled]}
        onPress={handleDone}
        disabled={completing}
      >
        <Text style={styles.buttonText}>Got it!</Text>
      </Pressable>

      <Pressable onPress={handleDone} style={styles.skip}>
        <Text style={styles.skipText}>Skip for now</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: {
    padding: 24,
    paddingTop: 60,
    gap: 16,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  subheading: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  steps: { gap: 16 },
  step: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  stepContent: { flex: 1, gap: 4 },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  stepDesc: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  skip: { alignItems: 'center', marginTop: 8 },
  skipText: { color: COLORS.textMuted, fontSize: 14 },
});
