(function () {
  const script = document.currentScript;
  if (!(script instanceof HTMLScriptElement)) {
    return;
  }

  const publicKey = script.getAttribute('data-public-key')?.trim();
  if (!publicKey) {
    console.warn('[acs-widget] data-public-key is required');
    return;
  }

  const widgetOrigin = new URL(script.src, window.location.href).origin;
  const apiBase =
    script.getAttribute('data-api-base')?.trim() ||
    script.getAttribute('data-api-url')?.trim() ||
    '';
  const color = script.getAttribute('data-primary-color')?.trim() || '';
  const positionAttr = script.getAttribute('data-position')?.trim();
  const startOpen = script.getAttribute('data-open') === 'true';

  const params = new URLSearchParams({ pk: publicKey });
  if (apiBase) {
    params.set('api', apiBase);
  }
  if (color) {
    params.set('color', color);
  }
  if (positionAttr === 'left' || positionAttr === 'right') {
    params.set('position', positionAttr);
  }
  if (startOpen) {
    params.set('open', '1');
  }

  const iframe = document.createElement('iframe');
  iframe.src = `${widgetOrigin}/?${params.toString()}`;
  iframe.title = 'Support chat';
  iframe.setAttribute('aria-label', 'Support chat');
  iframe.allow = 'clipboard-write';
  iframe.setAttribute('referrerpolicy', 'origin');
  Object.assign(iframe.style, {
    position: 'fixed',
    zIndex: '2147483000',
    border: '0',
    background: 'transparent',
    colorScheme: 'light',
    maxWidth: '100vw',
    maxHeight: '100dvh',
    width: '88px',
    height: '88px',
    right: '16px',
    bottom: '16px',
    left: 'auto',
    pointerEvents: 'auto',
  });

  document.body.appendChild(iframe);

  window.addEventListener('message', (event) => {
    if (event.origin !== widgetOrigin || event.source !== iframe.contentWindow) {
      return;
    }

    const data = event.data;
    if (!data || data.source !== 'acs-widget' || data.type !== 'layout') {
      return;
    }

    const mobile = Boolean(data.mobile);
    const open = Boolean(data.open);
    const position = data.position === 'left' ? 'left' : 'right';

    if (open && mobile) {
      Object.assign(iframe.style, {
        width: '100vw',
        height: '100dvh',
        top: '0',
        bottom: '0',
        left: '0',
        right: '0',
      });
      return;
    }

    iframe.style.top = 'auto';
    iframe.style.bottom = '16px';
    iframe.style.left = position === 'left' ? '16px' : 'auto';
    iframe.style.right = position === 'right' ? '16px' : 'auto';

    if (open) {
      iframe.style.width = 'min(400px, calc(100vw - 24px))';
      iframe.style.height = 'min(680px, calc(100dvh - 24px))';
      return;
    }

    iframe.style.width = '88px';
    iframe.style.height = '88px';
  });
})();
