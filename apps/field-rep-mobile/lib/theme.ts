// Kosha brand theme — dark mode
// Inspired by Granola's dark UI

export const colors = {
  // Backgrounds
  background: '#0F0F0F',         // near black
  surface: '#1C1C1E',            // card/elevated surfaces
  surfaceHover: '#2C2C2E',       // pressed states
  border: '#2C2C2E',             // subtle borders
  borderLight: '#1C1C1E',        // very subtle borders

  // Text
  text: '#F5F5F4',               // primary text (warm white)
  textSecondary: '#A8A29E',      // secondary text
  textMuted: '#78716C',          // muted text
  textPlaceholder: '#57534E',    // placeholder text
  textDisabled: '#3A3A3C',       // disabled text

  // Brand accent (fern green)
  accent: '#4F7942',             // fern green
  accentLight: '#2A3D24',        // dark green tint for backgrounds
  accentText: '#A8D99C',         // light green for text on dark bg

  // Semantic
  success: '#34C759',            // iOS green
  error: '#FF453A',              // iOS red
  warning: '#FFD60A',            // iOS yellow

  // UI
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.6)',
}

// Georgia for display/headers (brand), system SF for body (readability)
export const fonts = {
  display: 'Georgia',
  displayBold: 'Georgia-Bold',
  body: undefined as string | undefined,
}

export const fontSizes = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 36,
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 48,
}

export const radii = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
}
