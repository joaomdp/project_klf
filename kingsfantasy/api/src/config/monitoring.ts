/**
 * Backend monitoring — Sentry lazy-init.
 *
 * Como habilitar:
 *   1. npm i @sentry/node (dentro do diretório api/)
 *   2. Adicione ao Render env vars:
 *        SENTRY_DSN=https://xxxx@oYYYY.ingest.sentry.io/ZZZZ
 *   3. Redeploy — Sentry captura exceções não tratadas.
 *
 * Sem DSN ou sem o pacote instalado, este módulo é no-op.
 */

type SentryLike = {
  init: (opts: Record<string, unknown>) => void;
  captureException: (err: unknown, opts?: Record<string, unknown>) => void;
};

let sentry: SentryLike | null = null;

export function initMonitoring() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  try {
    // require dinâmico pra não quebrar se @sentry/node não estiver instalado
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require('@sentry/node') as SentryLike;
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'production',
      tracesSampleRate: 0.1
    });
    sentry = Sentry;
    console.log('[monitoring] Sentry inicializado');
  } catch (err) {
    console.warn('[monitoring] @sentry/node não instalado ou falhou ao iniciar. Rode "npm i @sentry/node" no api/.');
  }
}

export function captureException(err: unknown, context?: Record<string, unknown>) {
  if (sentry) {
    sentry.captureException(err, { extra: context });
  } else {
    console.error('[monitoring]', err, context);
  }
}
