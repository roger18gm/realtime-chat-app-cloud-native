const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// serve static files
app.use(express.static(path.join(__dirname, "public")));

let sharedText = ""; // state all clients share

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

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = server;
