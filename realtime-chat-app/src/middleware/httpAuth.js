const jwt = require("jsonwebtoken");

/**
 * HTTP authentication middleware
 * Enforces JWT tokens from Cognito for protected routes
 */

const ENFORCE_AUTH = process.env.ENFORCE_AUTH === "true";
const COGNITO_REGION = process.env.COGNITO_REGION || "us-west-2";
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;

// Cache for Cognito public keys
let cognitoKeys = null;
let keysLastFetched = 0;
const KEYS_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

/**
 * Fetch Cognito public keys for JWT verification
 */
async function getCognitoPublicKeys() {
    const now = Date.now();

    // Return cached keys if still valid
    if (cognitoKeys && (now - keysLastFetched) < KEYS_CACHE_DURATION) {
        return cognitoKeys;
    }

    try {
        const jwksUrl = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/jwks.json`;
        const response = await fetch(jwksUrl);
        const data = await response.json();
        cognitoKeys = data.keys;
        keysLastFetched = now;
        return cognitoKeys;
    } catch (error) {
        console.error("Failed to fetch Cognito public keys:", error.message);
        throw error;
    }
}

/**
 * Verify JWT token from Cognito
 */
async function verifyToken(token) {
    const decoded = jwt.decode(token, { complete: true });

    if (!decoded) {
        throw new Error("Invalid token format");
    }

    const { header, payload } = decoded;
    const kid = header.kid;

    // Get public key from Cognito
    const keys = await getCognitoPublicKeys();
    const key = keys.find(k => k.kid === kid);

    if (!key) {
        throw new Error("Key not found in Cognito public keys");
    }

    // Convert JWKS to PEM format
    const jwkToPem = require("jwk-to-pem");
    const pem = jwkToPem(key);

    // Verify token signature
    try {
        jwt.verify(token, pem, {
            algorithms: ["RS256"],
            audience: payload.aud,
            issuer: `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`,
        });
        return payload;
    } catch (error) {
        throw new Error(`Token verification failed: ${error.message}`);
    }
}

/**
 * Express middleware for JWT validation
 * Extracts token from Authorization header
 */
const requireAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            if (ENFORCE_AUTH) {
                return res.status(401).json({ error: "Unauthorized: Missing or invalid Authorization header" });
            }
            // Continue without auth in development
            req.user = null;
            return next();
        }

        const token = authHeader.substring(7); // Remove "Bearer " prefix
        const payload = await verifyToken(token);

        req.user = {
            userId: payload.sub,
            email: payload.email,
        };
        next();
    } catch (error) {
        if (ENFORCE_AUTH) {
            console.warn(`HTTP auth failed: ${error.message}`);
            return res.status(401).json({ error: `Unauthorized: ${error.message}` });
        }
        // Continue without auth in development
        req.user = null;
        next();
    }
};

module.exports = {
    requireAuth,
    ENFORCE_AUTH,
};
