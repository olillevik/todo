import http from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { isValidLogin } from "./auth";

const COLUMN_NAMES = ["Todo", "Doing", "Done"];

// The id is internal to the server: it gives a move a stable target, since an item's position changes.
type Item = { id: string; description: string };
type Column = { name: string; items: Item[] };

function readJson(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): void {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

function sessionToken(req: http.IncomingMessage): string | undefined {
  const match = /(?:^|;\s*)session=([^;]+)/.exec(req.headers.cookie ?? "");
  return match?.[1];
}

export function createServer(): http.Server {
  // Sessions and the todo list live inside this server instance. A restart creates a new
  // instance, so old sessions are gone and the todo list starts empty.
  const sessions = new Set<string>();
  const todoList: { columns: Column[] } = {
    columns: COLUMN_NAMES.map((name): Column => ({ name, items: [] })),
  };

  function hasSession(req: http.IncomingMessage): boolean {
    const token = sessionToken(req);
    return token !== undefined && sessions.has(token);
  }

  return http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/api/hello") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Hello from the API" }));
      return;
    }

    if (req.method === "POST" && req.url === "/api/login") {
      const body: unknown = await readJson(req).catch(() => null);
      const { username, password } = (body ?? {}) as Record<string, unknown>;

      if (!isValidLogin(username, password)) {
        sendJson(res, 401, { error: "Invalid username or password" });
        return;
      }

      const token = randomBytes(32).toString("base64url");
      sessions.add(token);
      res.writeHead(204, { "Set-Cookie": `session=${token}; HttpOnly; Path=/; SameSite=Lax` });
      res.end();
      return;
    }

    if (req.method === "GET" && req.url === "/api/todo-list") {
      if (!hasSession(req)) {
        sendJson(res, 401, { error: "Not logged in" });
        return;
      }

      sendJson(res, 200, todoList);
      return;
    }

    if (req.method === "POST" && req.url === "/api/todo-list/items") {
      if (!hasSession(req)) {
        sendJson(res, 401, { error: "Not logged in" });
        return;
      }

      const body: unknown = await readJson(req).catch(() => null);
      const { description } = (body ?? {}) as Record<string, unknown>;
      if (typeof description !== "string" || description.trim() === "") {
        sendJson(res, 400, { error: "Description is required" });
        return;
      }

      todoList.columns[0].items.push({ id: randomUUID(), description: description.trim() });
      sendJson(res, 201, todoList);
      return;
    }

    const move = /^\/api\/todo-list\/items\/([^/]+)\/move$/.exec(req.url ?? "");
    if (req.method === "POST" && move) {
      if (!hasSession(req)) {
        sendJson(res, 401, { error: "Not logged in" });
        return;
      }

      const itemId = move[1];
      const body: unknown = await readJson(req).catch(() => null);
      const { column } = (body ?? {}) as { column?: string };
      const source = todoList.columns.find((candidate) => candidate.items.some((item) => item.id === itemId));
      if (!source) {
        sendJson(res, 404, { error: "Item not found" });
        return;
      }
      const target = todoList.columns.find((candidate) => candidate.name === column);
      if (!target) {
        sendJson(res, 400, { error: "Unknown column" });
        return;
      }
      if (source !== target) {
        const index = source.items.findIndex((item) => item.id === itemId);
        target.items.push(...source.items.splice(index, 1));
      }
      sendJson(res, 200, todoList);
      return;
    }

    res.statusCode = 404;
    res.end();
  });
}
