/**
 * Room/Channel Management for WebSocket Connections
 * Each Twitch ID corresponds to a room/channel
 */

// Store active connections by Twitch ID
const rooms = new Map(); // twitchId -> Set<WebSocket>

/**
 * Handle new WebSocket connection
 */
export function handleConnection(ws, twitchId, clientType) {
  // Store metadata on the WebSocket object
  ws.twitchId = twitchId;
  ws.clientType = clientType;
  ws.isAlive = true;
  
  // Add to room
  if (!rooms.has(twitchId)) {
    rooms.set(twitchId, new Set());
  }
  rooms.get(twitchId).add(ws);
  
  console.log(`✅ Client connected: ${clientType} for Twitch ID ${twitchId} (${rooms.get(twitchId).size} total in room)`);
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    twitchId,
    clientType,
    message: 'Connected to game server'
  }));
  
  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(ws, message);
    } catch (error) {
      console.error('❌ Error parsing WebSocket message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  });
  
  // Handle ping/pong for keepalive
  ws.on('pong', () => {
    ws.isAlive = true;
    // Client responded to ping, connection is alive
  });
  
  // Also handle JSON ping messages (for browser clients that don't use native ping/pong)
  // This is a fallback - native WebSocket ping/pong should work automatically
  
  // Handle disconnect
  ws.on('close', (code, reason) => {
    removeFromRoom(ws, twitchId);
    console.log(`❌ Client disconnected: ${clientType} for Twitch ID ${twitchId} (code: ${code}, reason: ${reason?.toString() || 'none'})`);
  });
  
  // Handle errors
  ws.on('error', (error) => {
    console.error(`❌ WebSocket error for ${twitchId}:`, error);
    removeFromRoom(ws, twitchId);
  });
}

/**
 * Handle incoming WebSocket message
 */
function handleMessage(ws, message) {
  const { type, ...data } = message;
  
  switch (type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;
      
    case 'echo':
      // Echo back for testing
      ws.send(JSON.stringify({ type: 'echo', data }));
      break;
      
    case 'chat:typing':
      // User is typing indicator (optional)
      // Could broadcast to party members or world
      break;
      
    case 'chat:join':
      // User joining a chat channel (optional)
      break;
      
    case 'chat:leave':
      // User leaving a chat channel (optional)
      break;
      
    default:
      console.log(`📨 Received message type: ${type} from ${ws.twitchId}`);
      // Forward to appropriate handler
      // Most messages will be handled by the Electron client or overlay
  }
}

/**
 * Remove WebSocket from room
 */
function removeFromRoom(ws, twitchId) {
  if (rooms.has(twitchId)) {
    rooms.get(twitchId).delete(ws);
    if (rooms.get(twitchId).size === 0) {
      rooms.delete(twitchId);
      // Note: This log is informational only - room becomes empty when all clients disconnect
      // It does NOT cause disconnections. This is just for debugging.
      console.log(`🗑️ Room ${twitchId} is now empty (all clients disconnected)`);
    }
  }
}

/**
 * Get all clients in a room
 */
export function getRoomClients(twitchId) {
  return rooms.get(twitchId) || new Set();
}

/**
 * Get all active rooms
 */
export function getAllRooms() {
  return Array.from(rooms.keys());
}

/**
 * Set up keepalive ping for all connections
 */
export function setupKeepalive(wss) {
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        console.log(`💀 Terminating dead connection: ${ws.twitchId}`);
        return ws.terminate();
      }
      
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000); // Ping every 30 seconds
  
  return interval;
}
