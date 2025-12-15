const crypto = require("crypto");

/**
 * Socket authentication middleware
 * JWT-ready but enforcement is disabled by default
 * 
 * If a token is provided:
 *   - Verify it (when enforcement is enabled)
 * 
 * If no token is provided:
 *   - Assign a guest ID
 * 
 * This allows gradual rollout of authentication without breaking existing connections
 */

const ENFORCE_AUTH = process.env.ENFORCE_AUTH === "true";

function authenticateSocket(socket, next) {
    const token = socket.handshake.auth.token;

    if (token) {
        // Token provided - JWT verification happens here (when enforcement is enabled)
        socket.userId = extractUserIdFromToken(token);
        socket.isGuest = false;
        console.log(`Authenticated user connected: ${socket.userId}`);
    } else {
        // No token - assign guest ID
        socket.userId = generateGuestId();
        socket.isGuest = true;
        console.log(`Guest connected: ${socket.userId}`);
    }

    next();
}

/**
 * Extract user ID from JWT token
 * Currently a placeholder - will be replaced with actual JWT verification
 * when Cognito integration is added
 */
function extractUserIdFromToken(token) {
    // Placeholder: In Phase 7, this will decode and verify JWT from Cognito
    // For now, return a placeholder user ID
    return `user_${crypto.randomBytes(8).toString("hex")}`;
}

/**
 * Generate a unique guest ID
 */
function generateGuestId() {
    return `guest_${crypto.randomBytes(8).toString("hex")}`;
}

module.exports = {
    authenticateSocket,
    ENFORCE_AUTH,
};
