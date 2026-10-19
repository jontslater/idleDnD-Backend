import rateLimit from 'express-rate-limit';

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const maxAuth = Number(process.env.RATE_LIMIT_AUTH_MAX || 30);
const maxWrite = Number(process.env.RATE_LIMIT_WRITE_MAX || 120);

export const authRateLimiter = rateLimit({
  windowMs,
  max: maxAuth,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Try again later.' }
});

export const writeRateLimiter = rateLimit({
  windowMs,
  max: maxWrite,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again later.' },
  skip: (req) => {
    const method = (req.method || 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;
    if (req.headers['x-streamer-key']) return true;
    return false;
  }
});
