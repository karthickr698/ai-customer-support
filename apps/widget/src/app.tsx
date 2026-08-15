import { useEffect, useMemo } from 'react';
import { Launcher } from './components/launcher';
import { WidgetPanel } from './components/panel';
import { readBootConfig } from './boot';
import { useWidget, type WidgetController } from './hooks/use-widget';

export function WidgetRoot() {
  const boot = useMemo(() => readBootConfig(), []);
  const widget = useWidget(boot);
  return <WidgetApp widget={widget} />;
}

export function WidgetApp({ widget }: { readonly widget: WidgetController }) {
  const position = widget.config?.position === 'left' ? 'left' : 'right';

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && widget.open) {
        widget.setOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [widget]);

  return (
    <div
      className={
        widget.mobile && widget.open
          ? 'flex h-[100dvh] w-screen flex-col p-0'
          : `flex h-[100dvh] flex-col justify-end gap-3 p-3 ${position === 'left' ? 'items-start' : 'items-end'}`
      }
    >
      {widget.open ? (
        <div className={widget.mobile ? 'min-h-0 flex-1' : 'h-[min(600px,calc(100dvh-96px))] w-full max-w-[376px]'}>
          <WidgetPanel
            onClose={() => {
              widget.setOpen(false);
            }}
            widget={widget}
          />
        </div>
      ) : null}
      {widget.mobile && widget.open ? null : (
        <Launcher
          label={widget.config?.launcherText ?? 'Open support chat'}
          onToggle={() => {
            widget.setOpen(!widget.open);
          }}
          open={widget.open}
        />
      )}
    </div>
  );
}
