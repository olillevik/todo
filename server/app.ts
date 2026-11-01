import http from "node:http";
import { randomBytes } from "node:crypto";
import { isValidLogin } from "./auth";
import { createTodoList, isColumnName } from "./todoList";

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

// The request's JSON body as an object. A missing or invalid body reads as {}.
async function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const body = await new Promise<unknown>((resolve, reject) => {
    let text = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => {
      text += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(text));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  }).catch(() => null);
  return (body ?? {}) as Record<string, unknown>;
}

function sessionToken(req: http.IncomingMessage): string | undefined {
  const match = /(?:^|;\s*)session=([^;]+)/.exec(req.headers.cookie ?? "");
  return match?.[1];
}

export function createServer(): http.Server {
  // Sessions and the todo list live inside this server instance. A restart creates a new
  // instance, so old sessions are gone and the todo list starts empty.
  const sessions = new Set<string>();
  const todoList = createTodoList();

  function hasSession(req: http.IncomingMessage): boolean {
    const token = sessionToken(req);
    return token !== undefined && sessions.has(token);
  }

  // Replies 401 and returns false when the request has no valid session.
  function requireSession(req: http.IncomingMessage, res: http.ServerResponse): boolean {
    if (hasSession(req)) return true;
    sendJson(res, 401, { error: "Not logged in" });
    return false;
  }

  return http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/api/hello") {
      sendJson(res, 200, { message: "Hello from the API" });
      return;
    }

    if (req.method === "POST" && req.url === "/api/login") {
      const { username, password } = await readBody(req);

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
      if (!requireSession(req, res)) return;

      sendJson(res, 200, todoList.reply());
      return;
    }

    if (req.method === "POST" && req.url === "/api/todo-list/items") {
      if (!requireSession(req, res)) return;

      const { description } = await readBody(req);
      if (typeof description !== "string" || description.trim() === "") {
        sendJson(res, 400, { error: "Description is required" });
        return;
      }

      todoList.add(description);
      sendJson(res, 201, todoList.reply());
      return;
    }

    const moveMatch = /^\/api\/todo-list\/items\/([^/]+)\/move$/.exec(req.url ?? "");
    if (req.method === "POST" && moveMatch) {
      if (!requireSession(req, res)) return;

      const itemId = moveMatch[1];
      const { column } = await readBody(req);
      if (!todoList.hasItem(itemId)) {
        sendJson(res, 404, { error: "Item not found" });
        return;
      }
      if (!isColumnName(column)) {
        sendJson(res, 400, { error: "Unknown column" });
        return;
      }

      todoList.move(itemId, column);
      sendJson(res, 200, todoList.reply());
      return;
    }

    res.statusCode = 404;
    res.end();
  });
}
