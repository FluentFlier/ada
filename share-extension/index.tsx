/**
 * iOS Share Extension entry point.
 *
 * Memory limit: 120MB. Must dismiss in <2 seconds.
 * Strategy: heuristic classify → save to InsForge → dismiss.
 * Gemini classification happens async in edge function.
 */

import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { processSharedContent } from '@/services/share-handler';
import { getCurrentUser } from '@/services/insforge';
import { getCategoryDef } from '@/constants/categories';
import { CONFIG } from '@/constants/config';

// expo-share-extension provides these:
// import { close, useShareIntent } from 'expo-share-extension';

export default function ShareExtension() {
  const [status, setStatus] = useState<'loading' | 'saved' | 'error'>(
    'loading',
  );
  const [categoryHint, setCategoryHint] = useState('');

  useEffect(() => {
    handleShare();
  }, []);

  async function handleShare() {
    try {
      // TODO: Replace with actual expo-share-extension hooks
      // const { text, url, images } = useShareIntent();
      const text = ''; // placeholder
      const url = ''; // placeholder

      const user = await getCurrentUser();
      if (!user) {
        setStatus('error');
        return;
      }

      const result = await processSharedContent(user.id, {
        text,
        url,
        sourceApp: 'share-extension',
      });

      const cat = getCategoryDef(result.heuristicHint.category);
      setCategoryHint(cat.label);
      setStatus('saved');

      // Auto-dismiss after brief feedback
      setTimeout(() => {
        // close(); // expo-share-extension dismiss
      }, CONFIG.shareExtension.dismissDelayMs);
    } catch (err) {
      console.error('Share extension error:', err);
      setStatus('error');
    }
  }

  return (
    <View style={styles.container}>
      {status === 'loading' && (
        <>
          <ActivityIndicator size="small" color="#6366F1" />
          <Text style={styles.text}>Saving to Ada...</Text>
        </>
      )}
      {status === 'saved' && (
        <>
          <Text style={styles.check}>✓</Text>
          <Text style={styles.text}>Saved</Text>
          {categoryHint ? (
            <Text style={styles.hint}>→ {categoryHint}</Text>
          ) : null}
        </>
      )}
      {status === 'error' && (
        <>
          <Text style={styles.errorIcon}>✗</Text>
          <Text style={styles.text}>
            Could not save. Please try again.
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F14',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  text: { color: '#9CA3AF', fontSize: 15 },
  check: { fontSize: 32, color: '#10B981' },
  hint: { color: '#6B7280', fontSize: 13 },
  errorIcon: { fontSize: 32, color: '#EF4444' },
});
