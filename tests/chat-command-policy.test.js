import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ESSENTIAL_CHAT_COMMANDS,
  REMOVED_CHAT_COMMANDS,
  PLAYER_PORTAL_URL,
  buildHelpReply,
  buildRemovedCommandReply,
  isEssentialChatCommand,
  isRemovedChatCommand,
  normalizeChatCommand,
} from '../src/services/chatCommandPolicy.js';

describe('chatCommandPolicy', () => {
  it('lists essential chat commands', () => {
    assert.deepEqual(ESSENTIAL_CHAT_COMMANDS.sort(), ['auto', 'help', 'hero', 'join', 'leave'].sort());
  });

  it('normalizes legacy aliases to essential handlers', () => {
    assert.equal(normalizeChatCommand('switch'), 'hero');
    assert.equal(normalizeChatCommand('tnew'), 'help');
    assert.equal(normalizeChatCommand('commands'), 'help');
  });

  it('treats essentials as not removed', () => {
    for (const cmd of ESSENTIAL_CHAT_COMMANDS) {
      assert.equal(isRemovedChatCommand(cmd), false, cmd);
      assert.equal(isEssentialChatCommand(cmd), true, cmd);
    }
    assert.equal(isRemovedChatCommand('switch'), false);
    assert.equal(isEssentialChatCommand('switch'), true);
  });

  it('redirects retired commands with portal link', () => {
    for (const cmd of ['heal', 'profession', 'qdungeon', 'stats', 'a']) {
      assert.equal(isRemovedChatCommand(cmd), true, cmd);
      const reply = buildRemovedCommandReply('viewer1', cmd);
      assert.equal(reply.success, false);
      assert.match(reply.message, /@viewer1/);
      assert.match(reply.message, new RegExp(PLAYER_PORTAL_URL.replace('.', '\\.')));
    }
  });

  it('redirects unknown commands', () => {
    assert.equal(isRemovedChatCommand('notrealcommand'), true);
    const reply = buildRemovedCommandReply('viewer1', 'notrealcommand');
    assert.match(reply.message, /!notrealcommand/);
  });

  it('help reply lists essentials and portal', () => {
    const reply = buildHelpReply('streamer');
    assert.equal(reply.success, true);
    assert.match(reply.message, /!join/);
    assert.match(reply.message, /!hero/);
    assert.match(reply.message, /!auto/);
    assert.match(reply.message, /!leave/);
    assert.match(reply.message, new RegExp(PLAYER_PORTAL_URL.replace('.', '\\.')));
  });

  it('documents a stable removed-command inventory', () => {
    assert.ok(REMOVED_CHAT_COMMANDS.includes('heal'));
    assert.ok(REMOVED_CHAT_COMMANDS.includes('rejoin'));
    assert.ok(REMOVED_CHAT_COMMANDS.includes('grantlegendary'));
    assert.equal(REMOVED_CHAT_COMMANDS.filter((c) => c === 'switch').length, 0);
  });
});
