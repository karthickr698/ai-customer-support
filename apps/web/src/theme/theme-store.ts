import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { applyTheme } from './apply-theme';
import { DEFAULT_THEME, THEME_STORAGE_KEY } from './tokens';
import type { FontId, PrimaryId, SecondaryId, SkinId, ThemeMode, ThemePreference } from './types';

type ThemeState = ThemePreference & {
  readonly setPrimary: (primary: PrimaryId) => void;
  readonly setSecondary: (secondary: SecondaryId) => void;
  readonly setFont: (font: FontId) => void;
  readonly setSkin: (skin: SkinId) => void;
  readonly setMode: (mode: ThemeMode) => void;
  readonly resetTheme: () => void;
};

function preferenceFrom(state: ThemePreference): ThemePreference {
  return {
    primary: state.primary,
    secondary: state.secondary,
    font: state.font,
    skin: state.skin,
    mode: state.mode,
  };
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_THEME,
      setPrimary: (primary) => {
        set({ primary });
        applyTheme(preferenceFrom(get()));
      },
      setSecondary: (secondary) => {
        set({ secondary });
        applyTheme(preferenceFrom(get()));
      },
      setFont: (font) => {
        set({ font });
        applyTheme(preferenceFrom(get()));
      },
      setSkin: (skin) => {
        set({ skin });
        applyTheme(preferenceFrom(get()));
      },
      setMode: (mode) => {
        set({ mode });
        applyTheme(preferenceFrom(get()));
      },
      resetTheme: () => {
        set({ ...DEFAULT_THEME });
        applyTheme(DEFAULT_THEME);
      },
    }),
    {
      name: THEME_STORAGE_KEY,
      partialize: (state) => ({
        primary: state.primary,
        secondary: state.secondary,
        font: state.font,
        skin: state.skin,
        mode: state.mode,
      }),
    },
  ),
);
