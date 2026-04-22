/**
 * Analytics — injeta Plausible se VITE_PLAUSIBLE_DOMAIN estiver setado.
 * Privacy-first, sem cookies, LGPD-friendly.
 *
 * Como habilitar:
 *   1. Crie conta em https://plausible.io (ou hospede self-hosted)
 *   2. Adicione ao .env do frontend (Vercel):
 *        VITE_PLAUSIBLE_DOMAIN=fantasykings.com.br
 *        VITE_PLAUSIBLE_SRC=https://plausible.io/js/script.js  (opcional)
 *   3. Redeploy — script é injetado automaticamente.
 */

let injected = false;

export function initAnalytics() {
  if (injected) return;
  const domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined;
  if (!domain) return;

  const src = (import.meta.env.VITE_PLAUSIBLE_SRC as string | undefined) || 'https://plausible.io/js/script.js';

  const script = document.createElement('script');
  script.defer = true;
  script.setAttribute('data-domain', domain);
  script.src = src;
  document.head.appendChild(script);
  injected = true;
}

export function trackEvent(name: string, props?: Record<string, string | number | boolean>) {
  const w = window as any;
  if (typeof w.plausible === 'function') {
    w.plausible(name, { props });
  }
}
