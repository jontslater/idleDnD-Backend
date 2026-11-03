/** Player Portal — chat commands not listed here should redirect viewers here. */
export const PLAYER_PORTAL_URL = 'https://theneverendingwar.com';

/** Chat commands that remain active (canonical names, lowercase). */
export const ESSENTIAL_CHAT_COMMANDS = ['join', 'leave', 'auto', 'hero', 'help'];

/**
 * Legacy / retired chat commands (canonical names and shorthand aliases).
 * Listed in PR description when trimming chat surface area.
 */
export const REMOVED_CHAT_COMMANDS = [
  // Combat
  'attack',
  'a',
  'heal',
  'h',
  'cast',
  'defend',
  'dispel',
  'rest',
  'potion',
  // Info & roster (use portal or !join [n] / !hero [n])
  'stats',
  's',
  'gear',
  'g',
  'heroes',
  'classes',
  'commands',
  // Shop & idle
  'shop',
  'buy',
  'use',
  'claim',
  'tokens',
  // Professions
  'profession',
  'gather',
  'herbs',
  'recipes',
  'craft',
  'elixirs',
  // Progression & rankings
  'quest',
  'quests',
  'skills',
  'leaderboard',
  'rank',
  'rejoin',
  // Dungeon / raid queues
  'dungeons',
  'raids',
  'dungeon',
  'raid',
  'qdungeon',
  'qraid',
  'qstatus',
  'qstart',
  'qcancel',
  'qleave',
  // Streamer dev / admin (portal or dashboard)
  'level',
  'grantlegendary',
  'grantlegendaries',
  'push',
  'pushfirebase',
  'sync',
  'syncfirebase',
];

const ESSENTIAL_SET = new Set(ESSENTIAL_CHAT_COMMANDS);
const REMOVED_SET = new Set(REMOVED_CHAT_COMMANDS.map((c) => c.toLowerCase()));

/** Map legacy names to essential handlers. */
const COMMAND_ALIASES = {
  switch: 'hero',
  tnew: 'help',
  commands: 'help',
};

/**
 * @param {string} command
 * @returns {string}
 */
export function normalizeChatCommand(command) {
  const raw = (command || '').toLowerCase().trim();
  return COMMAND_ALIASES[raw] || raw;
}

/**
 * @param {string} command — raw command from chat (before normalization)
 * @returns {boolean}
 */
export function isEssentialChatCommand(command) {
  return ESSENTIAL_SET.has(normalizeChatCommand(command));
}

/**
 * @param {string} command — raw command from chat
 * @returns {boolean}
 */
export function isRemovedChatCommand(command) {
  const normalized = normalizeChatCommand(command);
  if (ESSENTIAL_SET.has(normalized)) {
    return false;
  }
  if (normalized === 'join') {
    return false;
  }
  return REMOVED_SET.has(normalized) || !ESSENTIAL_SET.has(normalized);
}

/**
 * @param {string} viewerUsername
 * @param {string} command — raw command for display (e.g. "heal", "a")
 * @returns {{ success: boolean, message: string }}
 */
export function buildRemovedCommandReply(viewerUsername, command) {
  const display = (command || 'command').toLowerCase();
  return {
    success: false,
    message:
      `@${viewerUsername} !${display} is no longer available in chat. ` +
      `Use the Player Portal at ${PLAYER_PORTAL_URL} (or !help for chat basics).`,
  };
}

/**
 * @param {string} viewerUsername
 * @returns {{ success: boolean, message: string }}
 */
export function buildHelpReply(viewerUsername) {
  return {
    success: true,
    message:
      `@${viewerUsername} Chat: !join [class|#] · !hero [#|class] · !auto [on|off|buy|skills] · !leave · ` +
      `Full game at ${PLAYER_PORTAL_URL}`,
  };
}
