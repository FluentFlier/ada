/**
 * Root layout — auth gate, initialization, realtime setup.
 */

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/stores/auth';
import { useItemsStore } from '@/stores/items';
import {
  ActivityIndicator,
  View,
  StyleSheet,
} from 'react-native';

export default function RootLayout() {
  const { user, initialized, initialize } = useAuthStore();
  const { fetchItems, startRealtime } = useItemsStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!user) return;

    fetchItems(user.id);
    const unsubscribe = startRealtime(user.id);
    return unsubscribe;
  }, [user, fetchItems, startRealtime]);

  if (!initialized) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0F0F14' },
        }}
      >
        {user ? (
          <Stack.Screen name="(tabs)" />
        ) : (
          <Stack.Screen name="onboarding" />
        )}
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
    backgroundColor: '#0F0F14',
  },
});
