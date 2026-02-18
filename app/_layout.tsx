/**
 * Root layout — auth gate, initialization, realtime setup.
 *
 * Uses a single Stack with all screens defined. Redirect handles
 * routing based on auth state. This avoids the expo-router issue
 * of swapping Stack trees which breaks navigation state.
 */

import { useEffect } from 'react';
import { Stack, useSegments, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { COLORS } from '@/constants/theme';
import { useAuthStore } from '@/stores/auth';
import { useItemsStore } from '@/stores/items';
import { useActionsStore } from '@/stores/actions';
import {
  ActivityIndicator,
  View,
  StyleSheet,
} from 'react-native';

export default function RootLayout() {
  const { user, initialized, initialize, hasCompletedSetup } =
    useAuthStore();
  const { fetchItems, startRealtime } = useItemsStore();
  const { fetchActions } = useActionsStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!initialized) return;

    const currentRoute = segments[0];
    const authRoutes = ['onboarding', 'welcome'];
    const setupRoutes = ['permissions', 'setup-guide'];
    const inAuth = authRoutes.includes(currentRoute as string);
    const inSetup = setupRoutes.includes(currentRoute as string);

    if (!user && !inAuth) {
      router.replace(hasCompletedSetup ? '/onboarding' : '/welcome');
    } else if (user && inAuth) {
      if (!hasCompletedSetup) {
        router.replace('/permissions');
      } else {
        router.replace('/');
      }
    } else if (user && inSetup && hasCompletedSetup) {
      router.replace('/');
    }
  }, [user, initialized, hasCompletedSetup, segments, router]);

  useEffect(() => {
    if (!user) return;

    fetchItems(user.id);
    fetchActions(user.id);
    const unsubscribe = startRealtime(user.id);
    return unsubscribe;
  }, [user, fetchItems, fetchActions, startRealtime]);

  if (!initialized) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="permissions" />
        <Stack.Screen name="setup-guide" />
        <Stack.Screen
          name="item/[id]"
          options={{ headerShown: false, presentation: 'modal' }}
        />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
});
