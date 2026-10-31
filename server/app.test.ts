import type { AddressInfo } from "node:net";
import type http from "node:http";
import { describe, expect, it } from "vitest";
import { createServer } from "./app";
import { TEST_PASSWORD, TEST_USERNAME } from "./auth";

async function listen(server: http.Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

function close(server: http.Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

function postLogin(baseUrl: string, body: string): Promise<Response> {
  return fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

// Returns the "session=<token>" pair from a login response, ready to send back as a Cookie header.
function sessionCookieFrom(response: Response): string {
  const setCookie = response.headers.get("set-cookie") ?? "";
  return setCookie.split(";")[0];
}

it("GET /api/hello replies with a JSON message", async () => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/hello`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({ message: "Hello from the API" });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

describe("login", () => {
  it("POST /api/login with the test account sets an httpOnly session cookie with no expiry", async () => {
    const server = createServer();
    const baseUrl = await listen(server);

    try {
      const response = await postLogin(
        baseUrl,
        JSON.stringify({ username: TEST_USERNAME, password: TEST_PASSWORD }),
      );

      expect(response.status).toBe(204);
      const setCookie = response.headers.get("set-cookie") ?? "";
      expect(setCookie).toMatch(/^session=[^;]+/);
      expect(setCookie).toContain("HttpOnly");
      expect(setCookie).not.toMatch(/Max-Age|Expires/i);
    } finally {
      await close(server);
    }
  });

  it("wrong username, wrong password, or a bad body all get the same 401 reply with no cookie", async () => {
    const server = createServer();
    const baseUrl = await listen(server);

    try {
      const badBodies = [
        JSON.stringify({ username: "nobody", password: TEST_PASSWORD }),
        JSON.stringify({ username: TEST_USERNAME, password: "wrong-password" }),
        JSON.stringify({ username: "nobody", password: "wrong-password" }),
        JSON.stringify({ username: TEST_USERNAME }),
        "not json",
      ];

      for (const body of badBodies) {
        const response = await postLogin(baseUrl, body);

        expect(response.status).toBe(401);
        expect(response.headers.get("set-cookie")).toBeNull();
        expect(await response.json()).toEqual({ error: "Invalid username or password" });
      }
    } finally {
      await close(server);
    }
  });
});

describe("todo list", () => {
  it("GET /api/todo-list without a session replies 401", async () => {
    const server = createServer();
    const baseUrl = await listen(server);

    try {
      const response = await fetch(`${baseUrl}/api/todo-list`);

      expect(response.status).toBe(401);
    } finally {
      await close(server);
    }
  });

  it("GET /api/todo-list with an unknown session cookie replies 401", async () => {
    const server = createServer();
    const baseUrl = await listen(server);

    try {
      const response = await fetch(`${baseUrl}/api/todo-list`, {
        headers: { Cookie: "session=not-a-real-token" },
      });

      expect(response.status).toBe(401);
    } finally {
      await close(server);
    }
  });

  it("after logging in, GET /api/todo-list returns three empty columns: Todo, Doing, Done", async () => {
    const server = createServer();
    const baseUrl = await listen(server);

    try {
      const login = await postLogin(
        baseUrl,
        JSON.stringify({ username: TEST_USERNAME, password: TEST_PASSWORD }),
      );
      const response = await fetch(`${baseUrl}/api/todo-list`, {
        headers: { Cookie: sessionCookieFrom(login) },
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        columns: [
          { name: "Todo", items: [] },
          { name: "Doing", items: [] },
          { name: "Done", items: [] },
        ],
      });
    } finally {
      await close(server);
    }
  });

  it("a session ends when the server restarts", async () => {
    const first = createServer();
    const firstUrl = await listen(first);
    const login = await postLogin(
      firstUrl,
      JSON.stringify({ username: TEST_USERNAME, password: TEST_PASSWORD }),
    );
    const cookie = sessionCookieFrom(login);
    await close(first);

    const restarted = createServer();
    const restartedUrl = await listen(restarted);

    try {
      const response = await fetch(`${restartedUrl}/api/todo-list`, {
        headers: { Cookie: cookie },
      });

      expect(response.status).toBe(401);
    } finally {
      await close(restarted);
    }
  });
});
