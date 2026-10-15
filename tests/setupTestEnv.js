/** Shared test environment: in-memory Firestore + fixed JWT secret */

export const TEST_JWT_SECRET = 'test-jwt-secret-32-chars-min!!!';
export const VALID_STREAMER_KEY = 'overlay-key-streamer1-32bytes!!';
export const WRONG_STREAMER_KEY = 'overlay-key-wrongstreamer-32bytes';

export function applyTestEnv() {
  process.env.NODE_ENV = 'test';
  process.env.USE_IN_MEMORY_FIRESTORE = '1';
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  process.env.INTERNAL_API_KEY = 'internal-key-test-32-characters!!';
  process.env.ADMIN_KEY = 'admin-key-test-32-characters-min!';

  globalThis.__IN_MEMORY_FIRESTORE_SEED__ = {
    streamerSettings: {
      streamer1: {
        overlayKey: VALID_STREAMER_KEY,
        twitchUsername: 'streamer1'
      }
    },
    heroes: {
      'hero-on-bf1': {
        twitchUserId: '111',
        currentBattlefieldId: 'twitch:streamer1'
      },
      'hero-other-bf': {
        twitchUserId: '222',
        currentBattlefieldId: 'twitch:otherstreamer'
      }
    }
  };
}
