const { Server } = require("socket.io");

let sharedText = ""; // state all clients share

function setupSockets(server) {
    const io = new Server(server);

    io.on("connection", (socket) => {
        console.log("A user connected:", socket.id);

        // send the current text to the newly connected client
        socket.emit("initialize", sharedText);

        // handle text updates
        socket.on("textUpdate", (newText) => {
            sharedText = newText;
            socket.broadcast.emit("textUpdate", newText);
        });

        socket.on("disconnect", () => {
            console.log("User disconnected:", socket.id);
        });
    });

    return io;
}

module.exports = setupSockets;
