const { Server } = require("socket.io");
const { authenticateSocket } = require("../middleware/socketAuth.js");

let sharedText = ""; // state all clients share

function setupSockets(server) {
    const io = new Server(server);

    // Apply socket authentication middleware
    io.use(authenticateSocket);

    io.on("connection", (socket) => {
        console.log(`Connected - User ID: ${socket.userId}, Guest: ${socket.isGuest}`);

        // send the current text to the newly connected client
        socket.emit("initialize", sharedText);

        // handle text updates
        socket.on("textUpdate", (newText) => {
            sharedText = newText;
            socket.broadcast.emit("textUpdate", newText);
        });

        socket.on("disconnect", () => {
            console.log(`Disconnected - User ID: ${socket.userId}`);
        });
    });

    return io;
}

module.exports = setupSockets;
