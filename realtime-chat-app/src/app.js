const express = require("express");
const http = require("http");
const path = require("path");
const setupSockets = require("./sockets/index.js");

const app = express();
const server = http.createServer(app);

// Setup Socket.IO
setupSockets(server);

// Health check endpoint
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

module.exports = { app, server };
