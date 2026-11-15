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
