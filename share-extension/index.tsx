/**
 * iOS Share Extension entry point.
 *
 * Memory limit: 120MB. Must dismiss in <2 seconds.
 * Strategy: heuristic classify -> save to InsForge -> dismiss.
 * Gemini classification happens async in edge function.
 */

import { useEffect, useState } from 'react';
import {
  View as RNView,
  Text as RNText,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { type InitialProps, close } from 'expo-share-extension';
import { COLORS } from '@/constants/theme';
import { processSharedContent } from '@/services/share-handler';
import { getCurrentUser } from '@/services/insforge';
import { getCategoryDef } from '@/constants/categories';
import { CONFIG } from '@/constants/config';

export default function ShareExtension(props: InitialProps) {
  const [status, setStatus] = useState<
    'loading' | 'saved' | 'auth_error' | 'error'
  >('loading');
  const [categoryHint, setCategoryHint] = useState('');

  useEffect(() => {
    handleShare(props);
  }, []);

  async function handleShare(intent: InitialProps) {
    try {
      const user = await getCurrentUser();
      if (!user) {
        setStatus('auth_error');
        return;
      }

      const text = intent.text ?? undefined;
      const url = intent.url ?? undefined;
      const imageUri = intent.images?.[0] ?? intent.files?.[0] ?? undefined;

      const result = await processSharedContent(user.id, {
        text,
        url,
        imageUri,
        sourceApp: 'share-extension',
      });

      const cat = getCategoryDef(result.heuristicHint.category);
      setCategoryHint(cat.label);
      setStatus('saved');

      // Auto-dismiss after brief feedback
      setTimeout(() => {
        close();
      }, CONFIG.shareExtension.dismissDelayMs);
    } catch (err: unknown) {
      console.error('Share extension error:', err);
      setStatus('error');

      // Still dismiss on error after a delay
      setTimeout(() => {
        close();
      }, 1500);
    }
  }

  return (
    <RNView style={styles.container}>
      {status === 'loading' && (
        <>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <RNText style={styles.text}>Saving to Ada...</RNText>
        </>
      )}
      {status === 'saved' && (
        <>
          <RNText style={styles.check}>✓</RNText>
          <RNText style={styles.text}>Saved</RNText>
          {categoryHint ? (
            <RNText style={styles.hint}>→ {categoryHint}</RNText>
          ) : null}
        </>
      )}
      {status === 'auth_error' && (
        <>
          <RNText style={styles.errorIcon}>✗</RNText>
          <RNText style={styles.text}>
            Open Ada to sign in first.
          </RNText>
        </>
      )}
      {status === 'error' && (
        <>
          <RNText style={styles.errorIcon}>✗</RNText>
          <RNText style={styles.text}>
            Could not save. Please try again.
          </RNText>
        </>
      )}
    </RNView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  text: { color: COLORS.textSecondary, fontSize: 15 },
  check: { fontSize: 32, color: COLORS.success },
  hint: { color: COLORS.textMuted, fontSize: 13 },
  errorIcon: { fontSize: 32, color: COLORS.danger },
});
