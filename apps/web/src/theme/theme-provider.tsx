import { type ReactNode, useEffect } from 'react';
import { applyTheme, watchSystemMode } from './apply-theme';
import { useThemeStore } from './theme-store';

export function ThemeProvider({ children }: { readonly children: ReactNode }) {
  const primary = useThemeStore((state) => state.primary);
  const secondary = useThemeStore((state) => state.secondary);
  const font = useThemeStore((state) => state.font);
  const skin = useThemeStore((state) => state.skin);
  const mode = useThemeStore((state) => state.mode);

  useEffect(() => {
    applyTheme({ primary, secondary, font, skin, mode });
    return watchSystemMode(mode, () => {
      applyTheme({ primary, secondary, font, skin, mode });
    });
  }, [primary, secondary, font, skin, mode]);

  return children;
}
