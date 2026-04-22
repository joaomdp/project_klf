/**
 * Monitoring hook — inicializa Sentry se VITE_SENTRY_DSN estiver setado.
 *
 * Como habilitar:
 *   1. Crie conta em https://sentry.io e pegue o DSN do projeto
 *   2. Adicione ao .env do frontend (Vercel):
 *        VITE_SENTRY_DSN=https://xxxx@oYYYY.ingest.sentry.io/ZZZZ
 *   3. Adicione ao index.html (antes do </head>):
 *        <script
 *          src="https://browser.sentry-cdn.com/8.47.0/bundle.min.js"
 *          integrity="sha384-..."
 *          crossorigin="anonymous"></script>
 *   4. Redeploy — Sentry captura erros automaticamente.
 */

let initialized = false;

export function initMonitoring() {
  if (initialized) return;
  initialized = true;

  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;

  const Sentry = (window as any).Sentry;
  if (!Sentry?.init) {
    if (import.meta.env.DEV) {
      console.warn('[monitoring] VITE_SENTRY_DSN definido mas window.Sentry ausente. Adicione o script do Sentry no index.html.');
    }
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE || 'production',
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.0,
      replaysOnErrorSampleRate: 1.0
    });
  } catch (err) {
    console.warn('[monitoring] Falha ao iniciar Sentry:', err);
  }
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  const Sentry = (window as any).Sentry;
  if (Sentry?.captureException) {
    Sentry.captureException(error, { extra: context });
  } else {
    console.error('[monitoring]', error, context);
  }
}
