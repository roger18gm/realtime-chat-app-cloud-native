/**
 * DynamoDB Service
 * Handles read/write access to room metadata and messages
 * Falls back to in-memory storage if DynamoDB is unavailable
 */

const {
    DynamoDBClient,
    GetItemCommand,
    ScanCommand,
    PutItemCommand,
    QueryCommand,
} = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");

const ROOMS_TABLE = process.env.DYNAMODB_ROOMS_TABLE || "ChatRooms";
const MESSAGES_TABLE = process.env.DYNAMODB_MESSAGES_TABLE || "ChatMessages";
const AWS_REGION = process.env.AWS_REGION || "us-west-2";
const MESSAGE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const MESSAGE_HISTORY_LIMIT = 50; // Fetch last N messages per room

let dynamoDbClient = null;
let isAvailable = false;

/**
 * Initialize DynamoDB client
 * Attempts to connect, but doesn't fail if unavailable
 */
async function initializeDynamoDB() {
    try {
        dynamoDbClient = new DynamoDBClient({ region: AWS_REGION });
        // Test connection by attempting a scan with limit 1
        await dynamoDbClient.send(
            new ScanCommand({
                TableName: ROOMS_TABLE,
                Limit: 1,
            })
        );
        isAvailable = true;
        console.log(`DynamoDB service initialized successfully for region ${AWS_REGION}`);
    } catch (error) {
        isAvailable = false;
        console.warn(
            `DynamoDB unavailable - using in-memory rooms only. Error: ${error.message}`
        );
    }
}

/**
 * Get room metadata from DynamoDB
 * Returns null if not found or DynamoDB unavailable
 */
async function getRoomMetadata(roomId) {
    if (!isAvailable || !dynamoDbClient) {
        return null;
    }

    try {
        const command = new GetItemCommand({
            TableName: ROOMS_TABLE,
            Key: {
                roomId: { S: roomId },
            },
        });

        const response = await dynamoDbClient.send(command);

        if (response.Item) {
            const room = unmarshall(response.Item);
            console.log(`Retrieved room metadata from DynamoDB: ${roomId}`);
            return room;
        }

        return null;
    } catch (error) {
        console.warn(`Failed to read room metadata from DynamoDB: ${error.message}`);
        return null;
    }
}

/**
 * Get all rooms metadata from DynamoDB
 * Returns empty array if DynamoDB unavailable
 */
async function getAllRoomMetadata() {
    if (!isAvailable || !dynamoDbClient) {
        return [];
    }

    try {
        const command = new ScanCommand({
            TableName: ROOMS_TABLE,
        });

        const response = await dynamoDbClient.send(command);

        if (response.Items) {
            const rooms = response.Items.map((item) => unmarshall(item));
            console.log(`Retrieved ${rooms.length} rooms from DynamoDB`);
            return rooms;
        }

        return [];
    } catch (error) {
        console.warn(`Failed to scan rooms from DynamoDB: ${error.message}`);
        return [];
    }
}

/**
 * Save message to DynamoDB
 * Includes TTL for automatic cleanup
 */
async function saveMessage(roomId, userId, displayName, content) {
    if (!isAvailable || !dynamoDbClient) {
        return false;
    }

    try {
        const timestamp = Date.now();
        const ttl = Math.floor(Date.now() / 1000) + MESSAGE_TTL_SECONDS;

        const command = new PutItemCommand({
            TableName: MESSAGES_TABLE,
            Item: marshall({
                roomId,
                timestamp,
                userId,
                displayName,
                content,
                ttl,
            }),
        });

        await dynamoDbClient.send(command);
        console.log(`Message saved to DynamoDB: ${roomId} at ${timestamp}`);
        return true;
    } catch (error) {
        console.warn(`Failed to save message to DynamoDB: ${error.message}`);
        return false;
    }
}

/**
 * Get message history from DynamoDB
 * Returns up to MESSAGE_HISTORY_LIMIT messages for a room
 */
async function getMessageHistory(roomId) {
    if (!isAvailable || !dynamoDbClient) {
        return [];
    }

    try {
        const command = new QueryCommand({
            TableName: MESSAGES_TABLE,
            KeyConditionExpression: "roomId = :roomId",
            ExpressionAttributeValues: {
                ":roomId": { S: roomId },
            },
            ScanIndexForward: false, // Sort descending (newest first)
            Limit: MESSAGE_HISTORY_LIMIT,
        });

        const response = await dynamoDbClient.send(command);

        if (response.Items && response.Items.length > 0) {
            const messages = response.Items.map((item) => unmarshall(item))
                .reverse(); // Reverse to oldest first for client display
            console.log(`Retrieved ${messages.length} messages from DynamoDB for room ${roomId}`);
            return messages;
        }

        return [];
    } catch (error) {
        console.warn(`Failed to read message history from DynamoDB: ${error.message}`);
        return [];
    }
}

/**
 * Check if DynamoDB is available
 */
function isDynamoDBAvailable() {
    return isAvailable;
}

module.exports = {
    initializeDynamoDB,
    getRoomMetadata,
    getAllRoomMetadata,
    saveMessage,
    getMessageHistory,
    isDynamoDBAvailable,
};
