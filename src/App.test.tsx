// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "./App";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// The server owns the real credentials and is tested in server/app.test.ts.
// Here fetch is mocked at the network boundary, so the form's typed values are arbitrary.
function stubApi(handler: (url: string, init?: RequestInit) => Response) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => handler(url, init));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const loggedOut = () => Response.json({ error: "Not logged in" }, { status: 401 });
const emptyBoard = () =>
  Response.json({
    columns: [
      { name: "Todo", items: [] },
      { name: "Doing", items: [] },
      { name: "Done", items: [] },
    ],
  });

it("shows the login form when the todo list is not available", async () => {
  stubApi((url) => {
    if (url === "/api/todo-list") return loggedOut();
    throw new Error(`unexpected request to ${url}`);
  });

  render(<App />);

  expect(await screen.findByLabelText("Username")).toBeDefined();
  expect(screen.getByLabelText("Password")).toBeDefined();
  expect(screen.getByRole("button", { name: "Log in" })).toBeDefined();
  expect(screen.queryByRole("region", { name: "Todo" })).toBeNull();
});

it("logging in shows three empty columns: Todo, Doing, Done", async () => {
  let loggedIn = false;
  const fetchMock = stubApi((url) => {
    if (url === "/api/todo-list") return loggedIn ? emptyBoard() : loggedOut();
    if (url === "/api/login") {
      loggedIn = true;
      return new Response(null, { status: 204 });
    }
    throw new Error(`unexpected request to ${url}`);
  });

  render(<App />);
  fireEvent.change(await screen.findByLabelText("Username"), { target: { value: "someone" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "a-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));

  await screen.findByRole("region", { name: "Todo" });
  const columns = screen.getAllByRole("region");
  expect(columns.map((column) => column.getAttribute("aria-label"))).toEqual(["Todo", "Doing", "Done"]);
  for (const column of columns) {
    expect(within(column).queryAllByRole("listitem")).toHaveLength(0);
  }
  expect(screen.queryByLabelText("Username")).toBeNull();

  const loginCall = fetchMock.mock.calls.find(([url]) => url === "/api/login");
  expect(loginCall?.[1]?.method).toBe("POST");
  expect(JSON.parse(loginCall?.[1]?.body as string)).toEqual({
    username: "someone",
    password: "a-password",
  });
});

it("a wrong username or password shows the same message and keeps the login form", async () => {
  stubApi((url) => {
    if (url === "/api/todo-list") return loggedOut();
    if (url === "/api/login") {
      return Response.json({ error: "Invalid username or password" }, { status: 401 });
    }
    throw new Error(`unexpected request to ${url}`);
  });

  render(<App />);
  fireEvent.change(await screen.findByLabelText("Username"), { target: { value: "someone" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "a-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));

  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toBe("Invalid username or password");
  expect(screen.getByLabelText("Username")).toBeDefined();
  expect(screen.queryByRole("region", { name: "Todo" })).toBeNull();
});

it("a page reload with a valid session shows the todo list without the login form", async () => {
  const fetchMock = stubApi((url) => {
    if (url === "/api/todo-list") return emptyBoard();
    throw new Error(`unexpected request to ${url}`);
  });

  render(<App />);

  expect(await screen.findByRole("region", { name: "Todo" })).toBeDefined();
  expect(screen.queryByLabelText("Username")).toBeNull();
  expect(fetchMock).toHaveBeenCalledWith("/api/todo-list");
});

// The board the server would return for these Todo descriptions, in order.
function boardWithTodo(descriptions: string[], status = 200) {
  return Response.json(
    {
      columns: [
        { name: "Todo", items: descriptions.map((description) => ({ description })) },
        { name: "Doing", items: [] },
        { name: "Done", items: [] },
      ],
    },
    { status },
  );
}

// Fake server for the add-item tests: the board lives in `todo` and POST adds to its end.
function stubBoardApi(todo: string[], rejectWith?: { status: number; error: string }) {
  return stubApi((url, init) => {
    if (url === "/api/todo-list") return boardWithTodo(todo);
    if (url === "/api/todo-list/items" && init?.method === "POST") {
      if (rejectWith) return Response.json({ error: rejectWith.error }, { status: rejectWith.status });
      todo.push((JSON.parse(init.body as string) as { description: string }).description);
      return boardWithTodo(todo, 201);
    }
    throw new Error(`unexpected request to ${url}`);
  });
}

it("the Todo column has a Description field and an Add button above its items; adding an item shows it in Todo and clears the field", async () => {
  stubBoardApi([]);

  render(<App />);
  const todoColumn = await screen.findByRole("region", { name: "Todo" });
  const field = within(todoColumn).getByLabelText("Description") as HTMLInputElement;
  const list = todoColumn.querySelector("ul") as HTMLElement;
  expect(field.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  fireEvent.change(field, { target: { value: "Buy milk" } });
  fireEvent.click(within(todoColumn).getByRole("button", { name: "Add" }));

  expect((await within(todoColumn).findByRole("listitem")).textContent).toBe("Buy milk");
  expect(field.value).toBe("");
});

it("a new item appears at the bottom of Todo, below the items already there", async () => {
  stubBoardApi(["Buy milk"]);

  render(<App />);
  const todoColumn = await screen.findByRole("region", { name: "Todo" });
  fireEvent.change(within(todoColumn).getByLabelText("Description"), { target: { value: "Walk dog" } });
  fireEvent.click(within(todoColumn).getByRole("button", { name: "Add" }));

  await waitFor(() => expect(within(todoColumn).getAllByRole("listitem")).toHaveLength(2));
  const items = within(todoColumn).getAllByRole("listitem");
  expect(items.map((item) => item.textContent)).toEqual(["Buy milk", "Walk dog"]);
  for (const column of screen.getAllByRole("region").slice(1)) {
    expect(within(column).queryAllByRole("listitem")).toHaveLength(0);
  }
});

it("a blank description is rejected with the server's message, adds no item, and keeps the typed text", async () => {
  stubBoardApi([], { status: 400, error: "Description is required" });

  render(<App />);
  const todoColumn = await screen.findByRole("region", { name: "Todo" });
  const field = within(todoColumn).getByLabelText("Description") as HTMLInputElement;
  fireEvent.change(field, { target: { value: "   " } });
  fireEvent.click(within(todoColumn).getByRole("button", { name: "Add" }));

  const alert = await within(todoColumn).findByRole("alert");
  expect(alert.textContent).toBe("Description is required");
  expect(within(todoColumn).queryAllByRole("listitem")).toHaveLength(0);
  expect(field.value).toBe("   ");
});
