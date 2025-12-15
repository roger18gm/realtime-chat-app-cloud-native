/**
 * DynamoDB Service
 * Handles read-only access to room metadata
 * Falls back to in-memory storage if DynamoDB is unavailable
 */

const { DynamoDBClient, GetItemCommand, ScanCommand } = require("@aws-sdk/client-dynamodb");
const { unmarshall } = require("@aws-sdk/util-dynamodb");

const ROOMS_TABLE = process.env.DYNAMODB_ROOMS_TABLE || "ChatRooms";
const AWS_REGION = process.env.AWS_REGION || "us-west-2";

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
 * Check if DynamoDB is available
 */
function isDynamoDBAvailable() {
    return isAvailable;
}

module.exports = {
    initializeDynamoDB,
    getRoomMetadata,
    getAllRoomMetadata,
    isDynamoDBAvailable,
};
