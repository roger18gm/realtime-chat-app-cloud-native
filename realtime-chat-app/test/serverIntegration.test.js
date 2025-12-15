const request = require("supertest");
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
