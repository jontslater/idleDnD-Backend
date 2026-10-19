/**
 * Structured logging; forwards errors to Sentry when SENTRY_DSN is set.
 */

let sentry = null;

async function loadSentry() {
  if (sentry !== null) return sentry;
  if (!process.env.SENTRY_DSN) {
    sentry = false;
    return sentry;
  }
  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV || 'development' });
    sentry = Sentry;
  } catch (e) {
    console.warn('[logger] Sentry init failed:', e.message);
    sentry = false;
  }
  return sentry;
}

export async function logError(context, error, extra = {}) {
  const payload = {
    context,
    message: error?.message || String(error),
    stack: error?.stack,
    ...extra
  };
  console.error(JSON.stringify({ level: 'error', ...payload }));
  const S = await loadSentry();
  if (S) {
    S.captureException(error, { extra: { context, ...extra } });
  }
}

export function logInfo(context, message, extra = {}) {
  console.log(JSON.stringify({ level: 'info', context, message, ...extra }));
}
