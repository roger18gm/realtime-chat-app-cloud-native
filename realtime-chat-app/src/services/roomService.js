/**
 * Room Management Service
 * Handles room creation, membership, and presence tracking
 * 
 * Rooms are stored in memory (ephemeral by design for presence)
 * Room metadata can be supplemented from DynamoDB if available
 */

const { getRoomMetadata } = require("./dynamoDbService.js");

const rooms = new Map();

/**
 * Room structure:
 * {
 *   roomId: string,
 *   name: string,
 *   users: Map<userId, { userId, displayName, isGuest }>,
 *   createdAt: timestamp,
 *   allowedGroups?: string[] (from DynamoDB metadata)
 * }
 */

/**
 * Get or create a room
 * Attempts to read metadata from DynamoDB if available
 */
async function getOrCreateRoom(roomId, name = null) {
    if (!rooms.has(roomId)) {
        // Try to get metadata from DynamoDB
        let dbMetadata = null;
        try {
            dbMetadata = await getRoomMetadata(roomId);
        } catch (error) {
            // Silently continue if DynamoDB read fails
            console.warn(`Could not fetch room metadata for ${roomId}: ${error.message}`);
        }

        rooms.set(roomId, {
            roomId,
            name: dbMetadata?.name || name || roomId,
            users: new Map(),
            createdAt: dbMetadata?.createdAt || Date.now(),
            allowedGroups: dbMetadata?.allowedGroups,
        });
    }
    return rooms.get(roomId);
}

/**
 * Add user to room
 */
function addUserToRoom(roomId, userId, displayName, isGuest) {
    const room = rooms.get(roomId);
    if (!room) {
        // Room doesn't exist yet - this shouldn't happen in normal flow
        return null;
    }
    room.users.set(userId, {
        userId,
        displayName,
        isGuest,
    });
    return room;
}

/**
 * Remove user from room
 */
function removeUserFromRoom(roomId, userId) {
    const room = rooms.get(roomId);
    if (!room) return null;

    room.users.delete(userId);

    // Delete room if empty
    if (room.users.size === 0) {
        rooms.delete(roomId);
        return null;
    }

    return room;
}

/**
 * Get room details
 */
function getRoom(roomId) {
    return rooms.get(roomId);
}

/**
 * Get all rooms
 */
function getAllRooms() {
    return Array.from(rooms.values());
}

/**
 * Get user count in room
 */
function getUserCountInRoom(roomId) {
    const room = rooms.get(roomId);
    return room ? room.users.size : 0;
}

/**
 * Get all users in room
 */
function getUsersInRoom(roomId) {
    const room = rooms.get(roomId);
    if (!room) return [];
    return Array.from(room.users.values());
}

module.exports = {
    getOrCreateRoom,
    addUserToRoom,
    removeUserFromRoom,
    getRoom,
    getAllRooms,
    getUserCountInRoom,
    getUsersInRoom,
};
