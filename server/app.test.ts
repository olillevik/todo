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

// Logs in as the test account and returns the "session=<token>" pair, ready to send back as a Cookie header.
async function loginCookie(baseUrl: string): Promise<string> {
  const response = await postLogin(
    baseUrl,
    JSON.stringify({ username: TEST_USERNAME, password: TEST_PASSWORD }),
  );
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
      const cookie = await loginCookie(baseUrl);
      const response = await fetch(`${baseUrl}/api/todo-list`, {
        headers: { Cookie: cookie },
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
    const cookie = await loginCookie(firstUrl);
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

function postItem(baseUrl: string, cookie: string, body: string): Promise<Response> {
  return fetch(`${baseUrl}/api/todo-list/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body,
  });
}

// The todo list with the given descriptions in each column, in order. The server picks each item's id,
// so the expected todo list accepts any string there, and the move tests read real ids from replies.
function todoListWith(columns: { Todo?: string[]; Doing?: string[]; Done?: string[] }) {
  const column = (name: "Todo" | "Doing" | "Done") => ({
    name,
    items: (columns[name] ?? []).map((description) => ({ id: expect.any(String), description })),
  });
  return { columns: [column("Todo"), column("Doing"), column("Done")] };
}

// The todo list after the given descriptions were added to Todo, in order.
function todoListWithTodo(descriptions: string[]) {
  return todoListWith({ Todo: descriptions });
}

describe("add item", () => {
  it("POST /api/todo-list/items with a session adds the item to Todo and replies with the todo list", async () => {
    const server = createServer();
    const baseUrl = await listen(server);

    try {
      const cookie = await loginCookie(baseUrl);

      const added = await postItem(baseUrl, cookie, JSON.stringify({ description: "Buy milk" }));

      expect(added.status).toBe(201);
      expect(await added.json()).toEqual(todoListWithTodo(["Buy milk"]));

      const response = await fetch(`${baseUrl}/api/todo-list`, { headers: { Cookie: cookie } });
      expect(await response.json()).toEqual(todoListWithTodo(["Buy milk"]));
    } finally {
      await close(server);
    }
  });

  it("each new item goes to the bottom of Todo, after the items already there", async () => {
    const server = createServer();
    const baseUrl = await listen(server);

    try {
      const cookie = await loginCookie(baseUrl);

      await postItem(baseUrl, cookie, JSON.stringify({ description: "Buy milk" }));
      const added = await postItem(baseUrl, cookie, JSON.stringify({ description: "Walk dog" }));

      expect(await added.json()).toEqual(todoListWithTodo(["Buy milk", "Walk dog"]));
    } finally {
      await close(server);
    }
  });

  it("the description is stored as typed, surrounding spaces included", async () => {
    const server = createServer();
    const baseUrl = await listen(server);

    try {
      const cookie = await loginCookie(baseUrl);

      const added = await postItem(baseUrl, cookie, JSON.stringify({ description: "  Buy milk  " }));

      expect(await added.json()).toEqual(todoListWithTodo(["  Buy milk  "]));
    } finally {
      await close(server);
    }
  });

  it("a blank, whitespace-only, missing or non-text description gets a 400 and adds nothing", async () => {
    const server = createServer();
    const baseUrl = await listen(server);

    try {
      const cookie = await loginCookie(baseUrl);

      const badBodies = [
        JSON.stringify({ description: "" }),
        JSON.stringify({ description: "   " }),
        JSON.stringify({ description: "\n\t " }),
        JSON.stringify({}),
        JSON.stringify({ description: 42 }),
        "not json",
      ];

      for (const body of badBodies) {
        const response = await postItem(baseUrl, cookie, body);

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: "Description is required" });
      }

      const reply = await fetch(`${baseUrl}/api/todo-list`, { headers: { Cookie: cookie } });
      expect(await reply.json()).toEqual(todoListWithTodo([]));
    } finally {
      await close(server);
    }
  });

  it("POST /api/todo-list/items without a valid session replies 401 and adds nothing", async () => {
    const server = createServer();
    const baseUrl = await listen(server);

    try {
      const cookie = await loginCookie(baseUrl);
      const body = JSON.stringify({ description: "Buy milk" });

      const noCookie = await fetch(`${baseUrl}/api/todo-list/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      expect(noCookie.status).toBe(401);

      const unknownCookie = await postItem(baseUrl, "session=not-a-real-token", body);
      expect(unknownCookie.status).toBe(401);

      const reply = await fetch(`${baseUrl}/api/todo-list`, { headers: { Cookie: cookie } });
      expect(await reply.json()).toEqual(todoListWithTodo([]));
    } finally {
      await close(server);
    }
  });
});

function postMove(baseUrl: string, cookie: string, itemId: string, column: string): Promise<Response> {
  return fetch(`${baseUrl}/api/todo-list/items/${itemId}/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ column }),
  });
}

type TodoListReply = { columns: { name: string; items: { id: string; description: string }[] }[] };

// The id the server gave the item with this description, read from a todo list reply.
function idOf(todoList: TodoListReply, description: string): string {
  const found = todoList.columns.flatMap((column) => column.items).find((candidate) => candidate.description === description);
  if (!found) throw new Error(`no item with description "${description}"`);
  return found.id;
}

// The name of the column that holds the item with this id, read from a todo list reply.
function columnOf(todoList: TodoListReply, id: string): string | undefined {
  return todoList.columns.find((column) => column.items.some((item) => item.id === id))?.name;
}

describe("move item", () => {
  it("POST /api/todo-list/items/:id/move moves the item to the bottom of another column, keeps its id, and replies with the todo list", async () => {
    const server = createServer();
    const baseUrl = await listen(server);

    try {
      const cookie = await loginCookie(baseUrl);
      const added = await postItem(baseUrl, cookie, JSON.stringify({ description: "Buy milk" }));
      const id = idOf(await added.json(), "Buy milk");

      const moved = await postMove(baseUrl, cookie, id, "Doing");

      expect(moved.status).toBe(200);
      const movedTodoList = await moved.json();
      expect(movedTodoList).toEqual(todoListWith({ Doing: ["Buy milk"] }));
      expect(movedTodoList.columns[1].items[0].id).toBe(id);

      const reply = await fetch(`${baseUrl}/api/todo-list`, { headers: { Cookie: cookie } });
      expect(await reply.json()).toEqual(todoListWith({ Doing: ["Buy milk"] }));
    } finally {
      await close(server);
    }
  });

  it("an item moved into a column that already has items goes below them", async () => {
    const server = createServer();
    const baseUrl = await listen(server);

    try {
      const cookie = await loginCookie(baseUrl);
      const first = idOf(
        await (await postItem(baseUrl, cookie, JSON.stringify({ description: "Write report" }))).json(),
        "Write report",
      );
      const second = idOf(
        await (await postItem(baseUrl, cookie, JSON.stringify({ description: "Buy milk" }))).json(),
        "Buy milk",
      );
      await postMove(baseUrl, cookie, first, "Doing");

      const moved = await postMove(baseUrl, cookie, second, "Doing");

      expect(await moved.json()).toEqual(todoListWith({ Doing: ["Write report", "Buy milk"] }));
    } finally {
      await close(server);
    }
  });

  it("moving an item to the column it is already in changes nothing, order included", async () => {
    const server = createServer();
    const baseUrl = await listen(server);

    try {
      const cookie = await loginCookie(baseUrl);
      await postItem(baseUrl, cookie, JSON.stringify({ description: "Buy milk" }));
      const added = await postItem(baseUrl, cookie, JSON.stringify({ description: "Walk dog" }));
      const first = idOf(await added.json(), "Buy milk");

      const moved = await postMove(baseUrl, cookie, first, "Todo");

      expect(moved.status).toBe(200);
      expect(await moved.json()).toEqual(todoListWithTodo(["Buy milk", "Walk dog"]));
    } finally {
      await close(server);
    }
  });

  it("an item can move from any column to any other, including backwards", async () => {
    const server = createServer();
    const baseUrl = await listen(server);

    try {
      const cookie = await loginCookie(baseUrl);
      const added = await postItem(baseUrl, cookie, JSON.stringify({ description: "Buy milk" }));
      const id = idOf(await added.json(), "Buy milk");

      // Todo to Doing, Doing to Done, Done back to Todo, Todo to Done, Done back to Doing, Doing back to Todo.
      // Together these cover all six directed pairs of the three columns.
      for (const column of ["Doing", "Done", "Todo", "Done", "Doing", "Todo"]) {
        const moved = await postMove(baseUrl, cookie, id, column);

        expect(moved.status).toBe(200);
        expect(columnOf(await moved.json(), id)).toBe(column);
      }
    } finally {
      await close(server);
    }
  });

  it("moving without a valid session replies 401 and moves nothing", async () => {
    const server = createServer();
    const baseUrl = await listen(server);

    try {
      const cookie = await loginCookie(baseUrl);
      const added = await postItem(baseUrl, cookie, JSON.stringify({ description: "Buy milk" }));
      const id = idOf(await added.json(), "Buy milk");
      const body = JSON.stringify({ column: "Done" });

      const noCookie = await fetch(`${baseUrl}/api/todo-list/items/${id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      expect(noCookie.status).toBe(401);

      const unknownCookie = await postMove(baseUrl, "session=not-a-real-token", id, "Done");
      expect(unknownCookie.status).toBe(401);

      const reply = await fetch(`${baseUrl}/api/todo-list`, { headers: { Cookie: cookie } });
      expect(await reply.json()).toEqual(todoListWithTodo(["Buy milk"]));
    } finally {
      await close(server);
    }
  });

  it("moving an item id that is not on the list replies 404 and moves nothing", async () => {
    const server = createServer();
    const baseUrl = await listen(server);

    try {
      const cookie = await loginCookie(baseUrl);
      await postItem(baseUrl, cookie, JSON.stringify({ description: "Buy milk" }));

      const response = await postMove(baseUrl, cookie, "not-a-real-item", "Done");

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "Item not found" });
      const reply = await fetch(`${baseUrl}/api/todo-list`, { headers: { Cookie: cookie } });
      expect(await reply.json()).toEqual(todoListWithTodo(["Buy milk"]));
    } finally {
      await close(server);
    }
  });

  it("moving to a name that is not a column, or with no column, replies 400 and moves nothing", async () => {
    const server = createServer();
    const baseUrl = await listen(server);

    try {
      const cookie = await loginCookie(baseUrl);
      const added = await postItem(baseUrl, cookie, JSON.stringify({ description: "Buy milk" }));
      const id = idOf(await added.json(), "Buy milk");

      const unknownColumn = await postMove(baseUrl, cookie, id, "Archive");
      expect(unknownColumn.status).toBe(400);
      expect(await unknownColumn.json()).toEqual({ error: "Unknown column" });

      const noColumn = await fetch(`${baseUrl}/api/todo-list/items/${id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({}),
      });
      expect(noColumn.status).toBe(400);
      expect(await noColumn.json()).toEqual({ error: "Unknown column" });

      const reply = await fetch(`${baseUrl}/api/todo-list`, { headers: { Cookie: cookie } });
      expect(await reply.json()).toEqual(todoListWithTodo(["Buy milk"]));
    } finally {
      await close(server);
    }
  });
});
