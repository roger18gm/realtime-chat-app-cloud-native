const express = require("express");
const http = require("http");
const path = require("path");
const setupSockets = require("./sockets/index.js");
const { initializeDynamoDB } = require("./services/dynamoDbService.js");
const { requireAuth } = require("./middleware/httpAuth.js");

const app = express();
const server = http.createServer(app);

// Setup Socket.IO
setupSockets(server);

// Cognito configuration
const COGNITO_DOMAIN = process.env.COGNITO_DOMAIN || "localhost";
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID || "dev-client";
const COGNITO_REGION = process.env.COGNITO_REGION || "us-west-2";

/**
 * Get the base URL from the request
 * Handles both localhost and ALB (respects X-Forwarded-Proto header)
 */
function getBaseUrl(req) {
    // Check X-Forwarded-Proto header (set by ALB)
    let protocol = req.get("X-Forwarded-Proto") || req.protocol || "http";
    let host = req.get("host") || "localhost:8080";
    return `${protocol}://${host}/`;
}

// Health check endpoint (no auth required)
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

// Cognito login endpoint (redirects to Hosted UI)
app.get("/login", (req, res) => {
    const baseUrl = getBaseUrl(req);
    const callbackUri = new URL("/callback", baseUrl).toString();
    const cognitoLoginUrl = `https://${COGNITO_DOMAIN}.auth.${COGNITO_REGION}.amazoncognito.com/login?` +
        `client_id=${COGNITO_CLIENT_ID}&` +
        `response_type=code&` +
        `redirect_uri=${encodeURIComponent(callbackUri)}`;
    res.redirect(cognitoLoginUrl);
});

// OAuth callback endpoint (Cognito redirects here with authorization code)
app.get("/callback", async (req, res) => {
    const { code, error } = req.query;

    if (error) {
        return res.status(400).send(`Authentication error: ${error}`);
    }

    if (!code) {
        return res.status(400).send("Missing authorization code");
    }

    // For now, just redirect to home with code as token (client will use this)
    // In a production app, you would exchange the code for tokens on the backend
    // For this simplified flow, we let the client handle the token exchange
    res.redirect(`/?token=${encodeURIComponent(code)}`);
});

// Cognito logout endpoint
app.get("/logout", (req, res) => {
    const redirectUri = getBaseUrl(req);
    const cognitoLogoutUrl = `https://${COGNITO_DOMAIN}.auth.${COGNITO_REGION}.amazoncognito.com/logout?` +
        `client_id=${COGNITO_CLIENT_ID}&` +
        `logout_uri=${encodeURIComponent(redirectUri)}`;
    res.redirect(cognitoLogoutUrl);
});

// Auth info endpoint (requires authentication)
app.get("/api/auth/me", requireAuth, (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    res.json({
        userId: req.user.userId,
        email: req.user.email,
    });
});

// Serve static files (index.html will handle client-side auth)
app.use(express.static(path.join(__dirname, "public")));

module.exports = { app, server };

// Initialize DynamoDB when module is loaded
initializeDynamoDB().catch((error) => {
    console.error(`Failed to initialize DynamoDB: ${error.message}`);
    // Don't re-throw - app should continue running without DynamoDB
});
