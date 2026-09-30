/**
 * JWT Configuration
 * Centralized JWT secret management with fail-closed security
 * 
 * SECURITY:
 * - Production: Server exits if JWT_SECRET not set
 * - Development: Generates random per-process secret with warnings
 * - No hardcoded fallbacks anywhere
 */

import crypto from 'crypto';

let JWT_SECRET;

if (process.env.JWT_SECRET) {
  JWT_SECRET = process.env.JWT_SECRET;
} else if (process.env.NODE_ENV === 'production') {
  console.error('❌ FATAL: JWT_SECRET environment variable is not set!');
  console.error('❌ The server cannot start in production without JWT_SECRET configured.');
  console.error('❌ Set JWT_SECRET in your environment and restart.');
  process.exit(1);
} else {
  // Development: generate random per-process secret with loud warning
  JWT_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('⚠️  ═══════════════════════════════════════════════════════════');
  console.warn('⚠️  WARNING: JWT_SECRET environment variable is not set!');
  console.warn('⚠️  Generated random per-process secret for development.');
  console.warn('⚠️  Sessions will break on server restart.');
  console.warn('⚠️  SET JWT_SECRET before deploying to production!');
  console.warn('⚠️  ═══════════════════════════════════════════════════════════');
}

export { JWT_SECRET };

const JWT_EXPIRES_IN = '30d';

export { JWT_EXPIRES_IN };
