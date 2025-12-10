/**
 * WebSocket Server for Real-Time Game Events
 * Handles chat commands, channel redeems, and extension purchases
 */

import { WebSocketServer } from 'ws';
import { handleConnection } from './rooms.js';
import { handleTwitchEvents } from './twitch-events.js';

let wss = null;

/**
 * Initialize WebSocket server
 */
export function initializeWebSocketServer(httpServer) {
  wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws'
  });

  wss.on('connection', (ws, req) => {
    console.log('🔌 New WebSocket connection');
    
    // Parse query parameters
    const url = new URL(req.url, `http://${req.headers.host}`);
    const twitchId = url.searchParams.get('twitchId');
    const clientType = url.searchParams.get('type') || 'electron'; // 'electron' or 'overlay'
    
    if (!twitchId) {
      console.warn('⚠️ WebSocket connection without twitchId, closing');
      ws.close(1008, 'Missing twitchId parameter');
      return;
    }
    
    // Handle connection based on client type
    handleConnection(ws, twitchId, clientType);
  });

  console.log('✅ WebSocket server initialized on /ws');
  return wss;
}

/**
 * Broadcast message to all clients in a room (by Twitch ID)
 * Special case: if twitchId is 'world', broadcast to all connected clients
 */
export function broadcastToRoom(twitchId, message) {
  if (!wss) return;
  
  const messageStr = JSON.stringify(message);
  let sent = 0;
  
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // 1 = OPEN
      // If twitchId is 'world', send to all clients
      // Otherwise, send only to clients in that room
      if (twitchId === 'world' || client.twitchId === twitchId) {
        client.send(messageStr);
        sent++;
      }
    }
  });
  
  if (sent > 0) {
    console.log(`📡 Broadcast to room ${twitchId}: ${sent} client(s)`);
  }
}

/**
 * Send message to specific client
 */
export function sendToClient(ws, message) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Get WebSocket server instance
 */
export function getWebSocketServer() {
  return wss;
}

/**
 * Initialize Twitch event handlers (chat commands, redeems, etc.)
 */
export function initializeTwitchEventHandlers() {
  // This will be called from the main server after WebSocket is initialized
  // It sets up listeners for Twitch events (tmi.js, EventSub, etc.)
  handleTwitchEvents();
}
