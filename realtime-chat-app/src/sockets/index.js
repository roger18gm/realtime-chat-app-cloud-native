const { Server } = require("socket.io");
const { authenticateSocket } = require("../middleware/socketAuth.js");
const {
    getOrCreateRoom,
    addUserToRoom,
    removeUserFromRoom,
    getUsersInRoom,
    getUserCountInRoom,
} = require("../services/roomService.js");
const { saveMessage, getMessageHistory } = require("../services/dynamoDbService.js");

let sharedText = ""; // state all clients share

function setupSockets(server) {
    const io = new Server(server);

    // Apply socket authentication middleware
    io.use(authenticateSocket);

    io.on("connection", (socket) => {
        console.log(`Connected - User ID: ${socket.userId}, Guest: ${socket.isGuest}`);

        // Handle room:join event (async to support DynamoDB reads)
        socket.on("room:join", async (roomId, callback) => {
            try {
                // Leave previous room if any
                if (socket.currentRoom) {
                    socket.leave(socket.currentRoom);
                    const prevRoom = removeUserFromRoom(socket.currentRoom, socket.userId);
                    if (prevRoom) {
                        io.to(socket.currentRoom).emit("room:user-left", {
                            userId: socket.userId,
                            displayName: socket.userId,
                            userCount: getUserCountInRoom(socket.currentRoom),
                        });
                    }
                }

                // Get or create room (may read from DynamoDB)
                const room = await getOrCreateRoom(roomId);

                // Join new room
                socket.currentRoom = roomId;
                socket.join(roomId);
                addUserToRoom(roomId, socket.userId, socket.userId, socket.isGuest);

                // Send current users in room to the joining user
                const usersInRoom = getUsersInRoom(roomId);
                socket.emit("room:users", {
                    roomId,
                    users: usersInRoom,
                    userCount: usersInRoom.length,
                });

                // Fetch and send message history
                const messageHistory = await getMessageHistory(roomId);
                socket.emit("room:history", {
                    roomId,
                    messages: messageHistory,
                });

                // Notify others in room
                socket.to(roomId).emit("room:user-joined", {
                    userId: socket.userId,
                    displayName: socket.userId,
                    userCount: getUserCountInRoom(roomId),
                });

                console.log(`User ${socket.userId} joined room ${roomId}`);
                if (callback) callback({ success: true });
            } catch (error) {
                console.error(`Error joining room ${roomId}: ${error.message}`);
                if (callback) callback({ success: false, error: error.message });
            }
        });

        // Handle room:leave event
        socket.on("room:leave", (roomId) => {
            if (socket.currentRoom === roomId) {
                socket.leave(roomId);
                removeUserFromRoom(roomId, socket.userId);
                socket.currentRoom = null;

                io.to(roomId).emit("room:user-left", {
                    userId: socket.userId,
                    displayName: socket.userId,
                    userCount: getUserCountInRoom(roomId),
                });

                console.log(`User ${socket.userId} left room ${roomId}`);
            }
        });

        // Handle message:send event
        socket.on("message:send", async (data) => {
            if (socket.currentRoom) {
                const message = {
                    userId: socket.userId,
                    displayName: socket.userId,
                    content: data.content,
                    timestamp: Date.now(),
                };

                // Save message to DynamoDB (non-blocking, fire-and-forget)
                saveMessage(
                    socket.currentRoom,
                    message.userId,
                    message.displayName,
                    message.content
                ).catch((error) => {
                    console.warn(`Failed to persist message: ${error.message}`);
                });

                // Broadcast immediately (don't wait for DynamoDB)
                io.to(socket.currentRoom).emit("message:new", message);
                console.log(`Message in room ${socket.currentRoom}: ${data.content}`);
            }
        });

        // Handle typing indicators
        socket.on("typing:start", () => {
            if (socket.currentRoom) {
                socket.to(socket.currentRoom).emit("typing:started", {
                    userId: socket.userId,
                    displayName: socket.userId,
                });
            }
        });

        socket.on("typing:stop", () => {
            if (socket.currentRoom) {
                socket.to(socket.currentRoom).emit("typing:stopped", {
                    userId: socket.userId,
                });
            }
        });

        // Handle disconnect
        socket.on("disconnect", () => {
            if (socket.currentRoom) {
                removeUserFromRoom(socket.currentRoom, socket.userId);
                io.to(socket.currentRoom).emit("room:user-left", {
                    userId: socket.userId,
                    displayName: socket.userId,
                    userCount: getUserCountInRoom(socket.currentRoom),
                });
            }
            console.log(`Disconnected - User ID: ${socket.userId}`);
        });
    });

    return io;
}

module.exports = setupSockets;
