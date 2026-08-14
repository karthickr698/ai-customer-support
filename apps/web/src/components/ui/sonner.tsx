import { useEffect, useState } from 'react';
import { Toaster as Sonner } from 'sonner';
import { useThemeStore } from '@/theme/theme-store';

function useToasterTheme(): 'light' | 'dark' {
  const mode = useThemeStore((state) => state.mode);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      setSystemDark(media.matches);
    };

    media.addEventListener('change', onChange);
    return () => {
      media.removeEventListener('change', onChange);
    };
  }, []);

  if (mode === 'dark') {
    return 'dark';
  }

  if (mode === 'light') {
    return 'light';
  }

  return systemDark ? 'dark' : 'light';
}

export function Toaster() {
  const theme = useToasterTheme();

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:border-border group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
    />
  );
}
