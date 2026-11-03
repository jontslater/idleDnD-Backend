const DEFAULT_ADMIN_LOGINS = ['theneverendingwar', 'tehchno'];

export function getSpriteOverrideAdminLogins() {
  const raw = process.env.SPRITE_OVERRIDE_ADMIN_LOGINS;
  if (raw && raw.trim()) {
    return new Set(
      raw
        .split(',')
        .map((login) => login.trim().toLowerCase())
        .filter(Boolean)
    );
  }
  return new Set(DEFAULT_ADMIN_LOGINS);
}

export function resolveTwitchLoginFromUser(user) {
  const login = (user?.twitchUsername || user?.displayName || '').toLowerCase();
  return login || null;
}

export function isSpriteOverrideAdmin(user) {
  const login = resolveTwitchLoginFromUser(user);
  if (!login) return false;
  return getSpriteOverrideAdminLogins().has(login);
}

export function requireSpriteOverrideAdmin(req, res, next) {
  if (!isSpriteOverrideAdmin(req.user)) {
    return res.status(403).json({ error: 'Forbidden: sprite override admin required' });
  }
  next();
}
