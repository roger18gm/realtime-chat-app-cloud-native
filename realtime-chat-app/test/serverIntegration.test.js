const request = require("supertest");
const { io: ioClient } = require("socket.io-client");
let server;

beforeAll(() => {
    server = require("../src/server.js");
});

afterAll((done) => {
    server.close(done);
});

test("GET / should return HTML", async () => {
    const res = await request(server).get("/");
    expect(res.status).toBe(200);
    expect(res.text.includes("Realtime Chat")).toBe(true);
});

test("GET /health should return 200 with ok status", async () => {
    const res = await request(server).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
});

test("Socket connection should work with guest (no token)", (done) => {
    const client = ioClient("http://localhost:8080", {
        reconnectionDelay: 0,
        forceNew: true,
        transports: ["websocket"],
        auth: {},
    });

    client.on("connect", () => {
        expect(client.connected).toBe(true);
        client.disconnect();
        done();
    });

    client.on("connect_error", (err) => {
        client.disconnect();
        done(err);
    });
});

test("User should join room and receive room data", (done) => {
    const client = ioClient("http://localhost:8080", {
        reconnectionDelay: 0,
        forceNew: true,
        transports: ["websocket"],
        auth: {},
    });

    client.on("room:users", (data) => {
        expect(data.roomId).toBe("general");
        expect(data.userCount).toBe(1);
        expect(Array.isArray(data.users)).toBe(true);
        client.disconnect();
        done();
    });

    client.on("connect", () => {
        client.emit("room:join", "general");
    });

    client.on("connect_error", (err) => {
        client.disconnect();
        done(err);
    });
});

test("Multiple users in same room should see presence updates", (done) => {
    const client1 = ioClient("http://localhost:8080", {
        reconnectionDelay: 0,
        forceNew: true,
        transports: ["websocket"],
        auth: {},
    });

    const client2 = ioClient("http://localhost:8080", {
        reconnectionDelay: 0,
        forceNew: true,
        transports: ["websocket"],
        auth: {},
    });

    let client1Ready = false;
    let userJoinedReceived = false;

    client1.on("room:users", () => {
        client1Ready = true;
        if (client1Ready && client2) {
            client2.emit("room:join", "general");
        }
    });

    client1.on("room:user-joined", (data) => {
        if (!userJoinedReceived) {
            userJoinedReceived = true;
            expect(data.userCount).toBe(2);
            client1.disconnect();
            client2.disconnect();
            done();
        }
    });

    client1.on("connect", () => {
        client1.emit("room:join", "general");
    });

    client1.on("connect_error", (err) => {
        client1.disconnect();
        client2.disconnect();
        done(err);
    });
});

test("Users can switch between rooms", (done) => {
    const client = ioClient("http://localhost:8080", {
        reconnectionDelay: 0,
        forceNew: true,
        transports: ["websocket"],
        auth: {},
    });

    let roomsVisited = [];

    client.on("room:users", (data) => {
        roomsVisited.push(data.roomId);
        if (roomsVisited.length === 1) {
            expect(roomsVisited[0]).toBe("general");
            client.emit("room:join", "engineering");
        } else if (roomsVisited.length === 2) {
            expect(roomsVisited[1]).toBe("engineering");
            client.disconnect();
            done();
        }
    });

    client.on("connect", () => {
        client.emit("room:join", "general");
    });

    client.on("connect_error", (err) => {
        client.disconnect();
        done(err);
    });
});

test("User leaving a room should emit user-left event", (done) => {
    const client1 = ioClient("http://localhost:8080", {
        reconnectionDelay: 0,
        forceNew: true,
        transports: ["websocket"],
        auth: {},
    });

    const client2 = ioClient("http://localhost:8080", {
        reconnectionDelay: 0,
        forceNew: true,
        transports: ["websocket"],
        auth: {},
    });

    let client1Ready = false;
    let client2Joined = false;
    let leftEventReceived = false;

    client1.on("room:users", () => {
        client1Ready = true;
        if (client1Ready && client2) {
            client2.emit("room:join", "general");
        }
    });

    client1.on("room:user-joined", () => {
        client2Joined = true;
        if (client1Ready && client2Joined) {
            setTimeout(() => {
                client2.emit("room:leave", "general");
            }, 100);
        }
    });

    client1.on("room:user-left", (data) => {
        if (!leftEventReceived) {
            leftEventReceived = true;
            expect(data.userCount).toBe(1);
            client1.disconnect();
            client2.disconnect();
            done();
        }
    });

    client1.on("connect", () => {
        client1.emit("room:join", "general");
    });

    client1.on("connect_error", (err) => {
        client1.disconnect();
        client2.disconnect();
        done(err);
    });
});

test("Messages sent in a room should be received by room members", (done) => {
    const client1 = ioClient("http://localhost:8080", {
        reconnectionDelay: 0,
        forceNew: true,
        transports: ["websocket"],
        auth: {},
    });

    const client2 = ioClient("http://localhost:8080", {
        reconnectionDelay: 0,
        forceNew: true,
        transports: ["websocket"],
        auth: {},
    });

    let client1Ready = false;
    let messageReceived = false;

    client1.on("room:users", () => {
        client1Ready = true;
        if (client1Ready && client2) {
            client2.emit("room:join", "general");
        }
    });

    client1.on("room:user-joined", () => {
        setTimeout(() => {
            client2.emit("message:send", { content: "Hello from client2" });
        }, 100);
    });

    client1.on("message:new", (message) => {
        if (!messageReceived) {
            messageReceived = true;
            expect(message.content).toBe("Hello from client2");
            client1.disconnect();
            client2.disconnect();
            done();
        }
    });

    client1.on("connect", () => {
        client1.emit("room:join", "general");
    });

    client1.on("connect_error", (err) => {
        client1.disconnect();
        client2.disconnect();
        done(err);
    });
});
