/**
 * App-wide configuration constants.
 */

export const CONFIG = {
  insforge: {
    url: process.env.EXPO_PUBLIC_INSFORGE_URL ?? '',
    anonKey: process.env.EXPO_PUBLIC_INSFORGE_ANON_KEY ?? '',
  },

  ai: {
    classifyModel: 'google/gemini-2.5-flash-lite',
    summarizeModel: 'google/gemini-2.5-flash',
    classifyTimeoutMs: 10_000,
    summarizeTimeoutMs: 15_000,
  },

  jina: {
    readerUrl: 'https://r.jina.ai',
    timeoutMs: 5_000,
  },

  shareExtension: {
    maxImageSizeMB: 5,
    dismissDelayMs: 500,
    maxTextLength: 10_000,
  },

  app: {
    name: 'Ada',
    tagline: "Share anything. It's handled.",
    version: '1.0.0',
  },
} as const;
