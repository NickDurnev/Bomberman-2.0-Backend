import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { uniqueName } from "../helpers/players";
import { startTestServer, TestServer } from "../helpers/server";

describe("http routes", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await server?.stop();
  });

  function postAuth(body: Record<string, unknown>) {
    return fetch(`${server.url}/api/v1/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("POST /api/v1/auth creates a user", async () => {
    const name = uniqueName("user");
    const email = `${name}@example.com`;

    const response = await postAuth({ name, email, picture: "" });

    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(300);
    const { default: User } = await import("@db/models/User");
    const user = await User.findOne({ email });
    expect(user).not.toBeNull();
    expect(user?.name).toBe(name);
  });

  it("POST /api/v1/auth with an unknown field returns 422", async () => {
    const name = uniqueName("user");

    const response = await postAuth({
      name,
      email: `${name}@example.com`,
      picture: "",
      unexpected: "field",
    });

    expect(response.status).toBe(422);
  });

  it("POST /api/v1/auth for an existing user returns the updated user", async () => {
    const name = uniqueName("user");
    const email = `${name}@example.com`;
    expect((await postAuth({ name, email, picture: "" })).status).toBe(201);

    // Cloudinary has no credentials in tests, so the upload fails and the
    // server stores the source URL.
    const picture = "https://example.com/avatar.png";
    const response = await postAuth({ name, email, picture });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      status: string;
      code: number;
      data: { user: { email: string; picture: string } };
    };
    expect(body.status).toBe("success");
    expect(body.code).toBe(200);
    expect(body.data.user.email).toBe(email);
    expect(body.data.user.picture).toBe(picture);
  });

  it("POST /api/v1/auth without a JSON body returns 422", async () => {
    const response = await fetch(`${server.url}/api/v1/auth`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "name=x",
    });

    expect(response.status).toBe(422);
    const body = (await response.json()) as {
      status: string;
      error: { details: { type: string }[] };
    };
    expect(body.status).toBe("failed");
    expect(body.error.details.map(({ type }) => type)).toContain(
      "any.required",
    );
  });

  it("GET / returns 200", async () => {
    const response = await fetch(`${server.url}/`);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
  });

  it("GET /api/v1 returns the greeting", async () => {
    const response = await fetch(`${server.url}/api/v1`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toBe("Hello it's update!");
  });

  it("GET /api/v1/stats returns stats", async () => {
    const response = await fetch(`${server.url}/api/v1/stats`);

    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(300);
    expect(response.headers.get("content-type")).toContain("application/json");
    const body = (await response.json()) as {
      data: { stats: unknown[]; total: number };
    };
    expect(Array.isArray(body.data.stats)).toBe(true);
    expect(typeof body.data.total).toBe("number");
  });
});
