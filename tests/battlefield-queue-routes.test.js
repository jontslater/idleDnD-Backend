import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  bodyUserIdMatchesAuth,
  heroBelongsToUser,
  heroMayJoinBattlefieldQueue,
  isValidLobbyType,
  parseTwitchBattlefieldId,
  streamerOwnsBattlefield,
} from '../src/utils/battlefieldQueueAuth.js';

describe('battlefieldQueueAuth', () => {
  it('parses twitch battlefield ids', () => {
    assert.equal(parseTwitchBattlefieldId('twitch:12345'), '12345');
    assert.equal(parseTwitchBattlefieldId('twitch%3A999'), '999');
    assert.equal(parseTwitchBattlefieldId('world'), null);
  });

  it('checks streamer ownership of battlefield', () => {
    assert.equal(streamerOwnsBattlefield('twitch:42', '42'), true);
    assert.equal(streamerOwnsBattlefield('twitch:42', '99'), false);
    assert.equal(streamerOwnsBattlefield('world', '42'), false);
  });

  it('matches body userId to JWT twitch id', () => {
    const authUser = { twitchUserId: '111', userId: 'hero-doc-1' };
    assert.equal(bodyUserIdMatchesAuth('111', authUser), true);
    assert.equal(bodyUserIdMatchesAuth('hero-doc-1', authUser), false);
  });

  it('validates hero ownership', () => {
    assert.equal(heroBelongsToUser({ twitchUserId: '5' }, '5'), true);
    assert.equal(heroBelongsToUser({ twitchUserId: '5' }, '6'), false);
  });

  it('defaults accessMode to battlefield-scoped join', () => {
    const heroOnBf = { currentBattlefieldId: 'twitch:1' };
    const heroElsewhere = { currentBattlefieldId: 'twitch:2' };
    assert.equal(heroMayJoinBattlefieldQueue(heroOnBf, 'twitch:1'), true);
    assert.equal(heroMayJoinBattlefieldQueue(heroElsewhere, 'twitch:1'), false);
    assert.equal(
      heroMayJoinBattlefieldQueue({ accessMode: 'global', currentBattlefieldId: 'world' }, 'twitch:1'),
      true
    );
  });

  it('accepts only dungeon and raid lobby types', () => {
    assert.equal(isValidLobbyType('dungeon'), true);
    assert.equal(isValidLobbyType('raid'), true);
    assert.equal(isValidLobbyType('worldboss'), false);
  });
});

describe('raid queue join contract', () => {
  it('documents required raid queue join fields', () => {
    const body = { userId: 'twitch-1', heroId: 'hero-abc', role: 'tank', itemScore: 500 };
    assert.ok(body.userId);
    assert.ok(body.heroId);
    assert.ok(['tank', 'healer', 'dps'].includes(body.role));
    assert.equal(typeof body.itemScore, 'number');
  });
});
