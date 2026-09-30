/**
 * Twitch OAuth Token Refresh Utility
 * 
 * Handles automatic token refresh before expiry and on 401 errors.
 * Tokens are never logged or returned in responses for security.
 * 
 * Required env vars:
 * - TWITCH_CLIENT_ID
 * - TWITCH_CLIENT_SECRET
 */

import fetch from 'node-fetch';
import { db } from '../index.js';

// Token refresh margin: refresh if token expires within 5 minutes
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/**
 * Refresh a Twitch OAuth access token using a stored refresh token
 * @param {string} refreshToken - The refresh token from Twitch
 * @returns {Promise<{accessToken: string, refreshToken: string, expiresAt: number} | null>}
 */
export async function refreshTwitchToken(refreshToken) {
  if (!refreshToken) {
    console.warn('[Token Refresh] No refresh token provided');
    return null;
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('[Token Refresh] Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET');
    return null;
  }

  try {
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Token Refresh] Failed:', response.status, '(response body not logged for security)');
      return null;
    }

    const data = await response.json();
    const expiresAt = Date.now() + (data.expires_in * 1000);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt
    };
  } catch (error) {
    console.error('[Token Refresh] Network error (details not logged for security)');
    return null;
  }
}

/**
 * Check if hero's token needs refresh and refresh it if necessary
 * @param {string} heroId - The hero document ID
 * @returns {Promise<{accessToken: string, success: boolean, needsRelink: boolean}>}
 */
export async function ensureFreshToken(heroId) {
  try {
    const heroRef = db.collection('heroes').doc(heroId);
    const heroDoc = await heroRef.get();

    if (!heroDoc.exists) {
      return { success: false, needsRelink: false, accessToken: null };
    }

    const hero = heroDoc.data();
    const { twitchAccessToken, twitchRefreshToken, twitchTokenExpiresAt } = hero;

    // No tokens stored
    if (!twitchAccessToken || !twitchRefreshToken) {
      return { success: false, needsRelink: false, accessToken: null };
    }

    // Check if token needs refresh (expires within margin)
    const now = Date.now();
    const expiresAt = twitchTokenExpiresAt || 0;
    const needsRefresh = expiresAt - now < REFRESH_MARGIN_MS;

    if (!needsRefresh) {
      return { success: true, needsRelink: false, accessToken: twitchAccessToken };
    }

    console.log(`[Token Refresh] Refreshing token for hero ${heroId}...`);

    // Attempt refresh
    const refreshed = await refreshTwitchToken(twitchRefreshToken);

    if (!refreshed) {
      // Refresh failed - mark account as needing re-authentication
      console.warn(`[Token Refresh] Failed to refresh token for hero ${heroId} - marking as needing re-link`);
      await heroRef.update({
        tokenExpired: true,
        twitchTokenExpiresAt: 0
      });
      return { success: false, needsRelink: true, accessToken: null };
    }

    // Update stored tokens
    await heroRef.update({
      twitchAccessToken: refreshed.accessToken,
      twitchRefreshToken: refreshed.refreshToken,
      twitchTokenExpiresAt: refreshed.expiresAt,
      tokenExpired: false
    });

    console.log(`[Token Refresh] Successfully refreshed token for hero ${heroId}`);
    return { success: true, needsRelink: false, accessToken: refreshed.accessToken };

  } catch (error) {
    console.error('[Token Refresh] Error ensuring fresh token (details not logged for security)');
    return { success: false, needsRelink: false, accessToken: null };
  }
}

/**
 * Handle 401 error from Twitch API - attempt token refresh and retry
 * @param {string} heroId - The hero document ID
 * @param {Function} apiCall - Async function that makes the Twitch API call, receives accessToken as parameter
 * @returns {Promise<any>} The result of the API call
 */
export async function retryWithTokenRefresh(heroId, apiCall) {
  try {
    // First, ensure we have a fresh token
    const tokenResult = await ensureFreshToken(heroId);

    if (!tokenResult.success) {
      throw new Error(tokenResult.needsRelink ? 'TOKEN_EXPIRED_NEEDS_RELINK' : 'NO_TOKEN_AVAILABLE');
    }

    // Try the API call with the fresh token
    try {
      return await apiCall(tokenResult.accessToken);
    } catch (error) {
      // If we get a 401, the token might have been revoked
      if (error.statusCode === 401 || error.status === 401) {
        console.warn(`[Token Refresh] Got 401 even with fresh token for hero ${heroId} - token may be revoked`);
        
        // Mark as needing re-link
        const heroRef = db.collection('heroes').doc(heroId);
        await heroRef.update({
          tokenExpired: true,
          twitchTokenExpiresAt: 0
        });

        throw new Error('TOKEN_EXPIRED_NEEDS_RELINK');
      }

      // Other error - rethrow
      throw error;
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Refresh tokens for all heroes whose tokens are expiring soon
 * Call this periodically (e.g., every 30 minutes) from a background job
 */
export async function refreshExpiringTokens() {
  try {
    const now = Date.now();
    const expiryThreshold = now + REFRESH_MARGIN_MS;

    // Find heroes with expiring tokens
    const heroesSnapshot = await db.collection('heroes')
      .where('twitchTokenExpiresAt', '>', 0)
      .where('twitchTokenExpiresAt', '<', expiryThreshold)
      .get();

    if (heroesSnapshot.empty) {
      console.log('[Token Refresh] No tokens need refresh');
      return { refreshed: 0, failed: 0 };
    }

    console.log(`[Token Refresh] Found ${heroesSnapshot.size} tokens needing refresh`);

    let refreshed = 0;
    let failed = 0;

    for (const heroDoc of heroesSnapshot.docs) {
      const result = await ensureFreshToken(heroDoc.id);
      if (result.success) {
        refreshed++;
      } else {
        failed++;
      }
    }

    console.log(`[Token Refresh] Complete: ${refreshed} refreshed, ${failed} failed`);
    return { refreshed, failed };

  } catch (error) {
    console.error('[Token Refresh] Error in background refresh (details not logged for security)');
    return { refreshed: 0, failed: 0 };
  }
}
