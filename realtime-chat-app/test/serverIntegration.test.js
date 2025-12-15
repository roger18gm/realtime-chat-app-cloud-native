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
    expect(res.text.includes("<textarea")).toBe(true);
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

test("Socket should receive initial text on connect", (done) => {
    const client = ioClient("http://localhost:8080", {
        reconnectionDelay: 0,
        forceNew: true,
        transports: ["websocket"],
        auth: {},
    });

    client.on("initialize", (data) => {
        expect(typeof data).toBe("string");
        client.disconnect();
        done();
    });

    client.on("connect_error", (err) => {
        client.disconnect();
        done(err);
    });
});
