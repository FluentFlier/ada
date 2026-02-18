/**
 * Centralized color palette for Ada's dark theme.
 * All screens and components should import from here instead of hardcoding hex values.
 */
export const COLORS = {
  // Backgrounds
  background: '#0F0F14',
  surface: '#1A1A24',
  surfaceElevated: '#2A2A3A',

  // Brand
  primary: '#6366F1',
  primaryLight: '#818CF8',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  textLight: '#D1D5DB',

  // Semantic
  danger: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',

  // Border
  border: '#1A1A24',
} as const;
