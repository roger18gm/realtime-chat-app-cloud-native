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
