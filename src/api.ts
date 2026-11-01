// The browser's only path to the API. Every call resolves to a result and never rejects for an HTTP
// error or a dropped connection, so components decide what to show.

export type ColumnName = "Todo" | "Doing" | "Done";
type Item = { id: string; description: string };
export type Column = { name: ColumnName; items: Item[] };

// status is null when no reply arrived at all. error is the server's message, when it sent one.
type Failure = { ok: false; status: number | null; error?: string };
type LoginResult = { ok: true } | Failure;
type TodoListResult = { ok: true; columns: Column[] } | Failure;

function postJson(url: string, body: unknown): Promise<Response | null> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
}

async function failureFrom(response: Response | null): Promise<Failure> {
  if (!response) return { ok: false, status: null };
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return {
    ok: false,
    status: response.status,
    error: typeof body?.error === "string" ? body.error : undefined,
  };
}

async function todoListFrom(response: Response | null): Promise<TodoListResult> {
  if (!response?.ok) return failureFrom(response);
  const body = (await response.json()) as { columns: Column[] };
  return { ok: true, columns: body.columns };
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const response = await postJson("/api/login", { username, password });
  return response?.ok ? { ok: true } : failureFrom(response);
}

export async function getTodoList(): Promise<TodoListResult> {
  return todoListFrom(await fetch("/api/todo-list").catch(() => null));
}

export function addItem(description: string): Promise<TodoListResult> {
  return postJson("/api/todo-list/items", { description }).then(todoListFrom);
}

export function moveItem(itemId: string, column: ColumnName): Promise<TodoListResult> {
  return postJson(`/api/todo-list/items/${itemId}/move`, { column }).then(todoListFrom);
}
