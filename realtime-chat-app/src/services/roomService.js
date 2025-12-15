/**
 * Room Management Service
 * Handles room creation, membership, and presence tracking
 * All data is stored in memory (ephemeral by design)
 */

const rooms = new Map();

/**
 * Room structure:
 * {
 *   roomId: string,
 *   name: string,
 *   users: Map<userId, { userId, displayName, isGuest }>,
 *   createdAt: timestamp
 * }
 */

/**
 * Get or create a room
 */
function getOrCreateRoom(roomId, name = null) {
    if (!rooms.has(roomId)) {
        rooms.set(roomId, {
            roomId,
            name: name || roomId,
            users: new Map(),
            createdAt: Date.now(),
        });
    }
    return rooms.get(roomId);
}

/**
 * Add user to room
 */
function addUserToRoom(roomId, userId, displayName, isGuest) {
    const room = getOrCreateRoom(roomId);
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
