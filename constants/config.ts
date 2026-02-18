/**
 * App-wide configuration constants.
 */

export const CONFIG = {
  insforge: {
    url: process.env.EXPO_PUBLIC_INSFORGE_URL ?? '',
    anonKey: process.env.EXPO_PUBLIC_INSFORGE_ANON_KEY ?? '',
  },

  ai: {
    classifyModel: 'openai/gpt-4o-mini',
    summarizeModel: 'anthropic/claude-sonnet-4.5',
    classifyTimeoutMs: 10_000,
    summarizeTimeoutMs: 15_000,
  },

  jina: {
    readerUrl: 'https://r.jina.ai',
    timeoutMs: 8_000,
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
