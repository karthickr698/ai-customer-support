export const PRIMARY_IDS = [
  'indigo',
  'blue',
  'sky',
  'teal',
  'emerald',
  'violet',
  'rose',
  'orange',
  'slate',
] as const;

export const SECONDARY_IDS = [
  'slate',
  'zinc',
  'stone',
  'blue',
  'teal',
  'violet',
  'amber',
  'rose',
] as const;

export const FONT_IDS = [
  'inter',
  'dm-sans',
  'plus-jakarta',
  'manrope',
  'outfit',
  'source-sans',
  'ibm-plex',
] as const;

export const SKIN_IDS = ['default', 'soft', 'sharp', 'tinted'] as const;

export const THEME_MODES = ['light', 'dark', 'system'] as const;

export type PrimaryId = (typeof PRIMARY_IDS)[number];
export type SecondaryId = (typeof SECONDARY_IDS)[number];
export type FontId = (typeof FONT_IDS)[number];
export type SkinId = (typeof SKIN_IDS)[number];
export type ThemeMode = (typeof THEME_MODES)[number];

export type ThemePreference = {
  readonly primary: PrimaryId;
  readonly secondary: SecondaryId;
  readonly font: FontId;
  readonly skin: SkinId;
  readonly mode: ThemeMode;
};
