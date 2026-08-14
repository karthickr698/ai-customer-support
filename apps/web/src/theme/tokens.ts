import type { FontId, PrimaryId, SecondaryId, SkinId } from './types';

export type ThemeChoice = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly swatch?: string;
};

export const PRIMARY_CHOICES: ReadonlyArray<ThemeChoice & { readonly id: PrimaryId }> = [
  { id: 'indigo', label: 'Indigo', description: 'Trust and support', swatch: 'oklch(0.488 0.217 264)' },
  { id: 'blue', label: 'Blue', description: 'Clear and direct', swatch: 'oklch(0.546 0.215 255)' },
  { id: 'sky', label: 'Sky', description: 'Open and calm', swatch: 'oklch(0.62 0.14 230)' },
  { id: 'teal', label: 'Teal', description: 'Balanced and modern', swatch: 'oklch(0.6 0.118 185)' },
  { id: 'emerald', label: 'Emerald', description: 'Success-forward', swatch: 'oklch(0.596 0.145 163)' },
  { id: 'violet', label: 'Violet', description: 'Creative product feel', swatch: 'oklch(0.541 0.247 293)' },
  { id: 'rose', label: 'Rose', description: 'Warm and human', swatch: 'oklch(0.586 0.222 17)' },
  { id: 'orange', label: 'Orange', description: 'Energetic accent', swatch: 'oklch(0.646 0.194 41)' },
  { id: 'slate', label: 'Slate', description: 'Neutral professional', swatch: 'oklch(0.37 0.02 264)' },
];

export const SECONDARY_CHOICES: ReadonlyArray<ThemeChoice & { readonly id: SecondaryId }> = [
  { id: 'slate', label: 'Slate', description: 'Cool gray surfaces', swatch: 'oklch(0.55 0.02 264)' },
  { id: 'zinc', label: 'Zinc', description: 'True neutral gray', swatch: 'oklch(0.55 0 0)' },
  { id: 'stone', label: 'Stone', description: 'Warm gray surfaces', swatch: 'oklch(0.55 0.015 70)' },
  { id: 'blue', label: 'Blue', description: 'Cool secondary tint', swatch: 'oklch(0.7 0.08 250)' },
  { id: 'teal', label: 'Teal', description: 'Fresh secondary tint', swatch: 'oklch(0.7 0.08 185)' },
  { id: 'violet', label: 'Violet', description: 'Soft purple tint', swatch: 'oklch(0.7 0.08 293)' },
  { id: 'amber', label: 'Amber', description: 'Warm highlight tint', swatch: 'oklch(0.8 0.12 85)' },
  { id: 'rose', label: 'Rose', description: 'Soft pink tint', swatch: 'oklch(0.75 0.08 15)' },
];

export const FONT_CHOICES: ReadonlyArray<
  ThemeChoice & { readonly id: FontId; readonly href: string; readonly family: string }
> = [
  {
    id: 'inter',
    label: 'Inter',
    description: 'Product default',
    family: "'Inter', ui-sans-serif, system-ui, sans-serif",
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  },
  {
    id: 'dm-sans',
    label: 'DM Sans',
    description: 'Geometric and friendly',
    family: "'DM Sans', ui-sans-serif, system-ui, sans-serif",
    href: 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap',
  },
  {
    id: 'plus-jakarta',
    label: 'Plus Jakarta Sans',
    description: 'Contemporary SaaS',
    family: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
    href: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap',
  },
  {
    id: 'manrope',
    label: 'Manrope',
    description: 'Rounded and readable',
    family: "'Manrope', ui-sans-serif, system-ui, sans-serif",
    href: 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap',
  },
  {
    id: 'outfit',
    label: 'Outfit',
    description: 'Display-friendly UI',
    family: "'Outfit', ui-sans-serif, system-ui, sans-serif",
    href: 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap',
  },
  {
    id: 'source-sans',
    label: 'Source Sans 3',
    description: 'Editorial clarity',
    family: "'Source Sans 3', ui-sans-serif, system-ui, sans-serif",
    href: 'https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap',
  },
  {
    id: 'ibm-plex',
    label: 'IBM Plex Sans',
    description: 'Technical and precise',
    family: "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif",
    href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap',
  },
];

export const SKIN_CHOICES: ReadonlyArray<ThemeChoice & { readonly id: SkinId }> = [
  { id: 'default', label: 'Default', description: 'Balanced radius and contrast' },
  { id: 'soft', label: 'Soft', description: 'Larger corners, lighter chrome' },
  { id: 'sharp', label: 'Sharp', description: 'Tight radius, stronger borders' },
  { id: 'tinted', label: 'Tinted', description: 'Surfaces pick up the primary hue' },
];

export const DEFAULT_THEME = {
  primary: 'indigo',
  secondary: 'slate',
  font: 'inter',
  skin: 'default',
  mode: 'system',
} as const;

export const THEME_STORAGE_KEY = 'acs-theme';
