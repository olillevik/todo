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
const emptyTodoList = () =>
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
    if (url === "/api/todo-list") return loggedIn ? emptyTodoList() : loggedOut();
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
    if (url === "/api/todo-list") return emptyTodoList();
    throw new Error(`unexpected request to ${url}`);
  });

  render(<App />);

  expect(await screen.findByRole("region", { name: "Todo" })).toBeDefined();
  expect(screen.queryByLabelText("Username")).toBeNull();
  expect(fetchMock).toHaveBeenCalledWith("/api/todo-list");
});

const COLUMN_NAMES = ["Todo", "Doing", "Done"] as const;
type ColumnName = (typeof COLUMN_NAMES)[number];
type FakeItem = { id: string; description: string };

// Fake server for the todo list tests. `initial` gives each column's descriptions in order, and every
// item gets an id. POST adds to the end of Todo, and a move request puts the item at the end of its
// target column.
function stubTodoListApi(
  initial: Partial<Record<ColumnName, string[]>>,
  options: {
    rejectAdd?: { status: number; error: string };
    rejectMove?: { status: number; error: string };
  } = {},
) {
  let nextId = 1;
  const newItem = (description: string): FakeItem => ({ id: `item-${nextId++}`, description });
  const itemsByColumn = Object.fromEntries(
    COLUMN_NAMES.map((name) => [name, (initial[name] ?? []).map(newItem)]),
  ) as Record<ColumnName, FakeItem[]>;
  const todoListResponse = (status = 200) =>
    Response.json(
      { columns: COLUMN_NAMES.map((name) => ({ name, items: itemsByColumn[name] })) },
      { status },
    );

  return stubApi((url, init) => {
    if (url === "/api/todo-list") return todoListResponse();

    if (url === "/api/todo-list/items" && init?.method === "POST") {
      if (options.rejectAdd) {
        return Response.json({ error: options.rejectAdd.error }, { status: options.rejectAdd.status });
      }
      itemsByColumn.Todo.push(newItem((JSON.parse(init.body as string) as { description: string }).description));
      return todoListResponse(201);
    }

    const moveMatch = /^\/api\/todo-list\/items\/([^/]+)\/move$/.exec(url);
    if (moveMatch && init?.method === "POST") {
      if (options.rejectMove) {
        return Response.json({ error: options.rejectMove.error }, { status: options.rejectMove.status });
      }
      const itemId = moveMatch[1];
      const target = (JSON.parse(init.body as string) as { column: ColumnName }).column;
      const source = COLUMN_NAMES.find((name) => itemsByColumn[name].some((item) => item.id === itemId));
      if (!source) return Response.json({ error: "Item not found" }, { status: 404 });
      if (source !== target) {
        const item = itemsByColumn[source].find((candidate) => candidate.id === itemId)!;
        itemsByColumn[source] = itemsByColumn[source].filter((candidate) => candidate !== item);
        itemsByColumn[target].push(item);
      }
      return todoListResponse();
    }

    throw new Error(`unexpected request to ${url}`);
  });
}

it("the Todo column has a Description field and an Add button above its items; adding an item shows it in Todo and clears the field", async () => {
  stubTodoListApi({});

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
  stubTodoListApi({ Todo: ["Buy milk"] });

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
  stubTodoListApi({}, { rejectAdd: { status: 400, error: "Description is required" } });

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

function regionFor(columnName: string): HTMLElement {
  return screen.getByRole("region", { name: columnName });
}

// The descriptions shown in one column, in order.
function itemsIn(columnName: string): (string | null)[] {
  return within(regionFor(columnName))
    .queryAllByRole("listitem")
    .map((item) => item.textContent);
}

// Lets pending handlers and fetch promises settle before a "nothing happened" check.
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

function moveRequests(fetchMock: ReturnType<typeof stubApi>) {
  return fetchMock.mock.calls.filter(([url]) => url.includes("/move"));
}

// A stand-in for the browser's DataTransfer, which jsdom does not provide. One instance is shared
// by every event of a single drag, so data set on dragstart can be read on drop.
function fakeDataTransfer() {
  const data = new Map<string, string>();
  return {
    dropEffect: "none",
    effectAllowed: "uninitialized",
    setData: (type: string, value: string) => {
      data.set(type, value);
    },
    getData: (type: string) => data.get(type) ?? "",
  };
}

// Drags the item with this description out of its column and releases it on `dropOn`.
function dragItem(description: string, fromColumn: string, dropOn: HTMLElement) {
  const item = within(regionFor(fromColumn)).getByText(description);
  const dataTransfer = fakeDataTransfer();
  fireEvent.dragStart(item, { dataTransfer });
  fireEvent.dragOver(dropOn, { dataTransfer });
  fireEvent.drop(dropOn, { dataTransfer });
  fireEvent.dragEnd(item, { dataTransfer });
}

it("dragging an item onto another column moves it to the bottom of that column", async () => {
  stubTodoListApi({ Todo: ["Buy milk"], Doing: ["Write report"] });

  render(<App />);
  await within(await screen.findByRole("region", { name: "Todo" })).findByText("Buy milk");
  dragItem("Buy milk", "Todo", regionFor("Doing"));

  await waitFor(() => expect(itemsIn("Doing")).toEqual(["Write report", "Buy milk"]));
  expect(itemsIn("Todo")).toEqual([]);
});

it("dragging an item back from Done to Todo moves it to the bottom of Todo", async () => {
  stubTodoListApi({ Todo: ["Buy milk"], Done: ["Walk dog"] });

  render(<App />);
  await within(await screen.findByRole("region", { name: "Todo" })).findByText("Buy milk");
  dragItem("Walk dog", "Done", regionFor("Todo"));

  await waitFor(() => expect(itemsIn("Todo")).toEqual(["Buy milk", "Walk dog"]));
  expect(itemsIn("Done")).toEqual([]);
});

it("dropping an item on its own column leaves it in place and sends no move", async () => {
  const fetchMock = stubTodoListApi({ Todo: ["Buy milk", "Walk dog"] });

  render(<App />);
  await within(await screen.findByRole("region", { name: "Todo" })).findByText("Walk dog");
  dragItem("Buy milk", "Todo", regionFor("Todo"));
  await flushPromises();

  expect(itemsIn("Todo")).toEqual(["Buy milk", "Walk dog"]);
  expect(moveRequests(fetchMock)).toEqual([]);
});

it("dropping an item outside every column leaves it in place and sends no move", async () => {
  const fetchMock = stubTodoListApi({ Todo: ["Buy milk"], Doing: ["Write report"] });

  render(<App />);
  await within(await screen.findByRole("region", { name: "Todo" })).findByText("Buy milk");
  dragItem("Buy milk", "Todo", screen.getByRole("main"));
  await flushPromises();

  expect(itemsIn("Todo")).toEqual(["Buy milk"]);
  expect(itemsIn("Doing")).toEqual(["Write report"]);
  expect(moveRequests(fetchMock)).toEqual([]);
});

it("a move the server rejects shows a message and leaves the item where it was", async () => {
  stubTodoListApi({ Todo: ["Buy milk"] }, { rejectMove: { status: 404, error: "Item not found" } });

  render(<App />);
  await within(await screen.findByRole("region", { name: "Todo" })).findByText("Buy milk");
  dragItem("Buy milk", "Todo", regionFor("Doing"));

  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toBe("Could not move item. Try again.");
  expect(itemsIn("Todo")).toEqual(["Buy milk"]);
  expect(itemsIn("Doing")).toEqual([]);
});

it("after the server restarts, an add the server rejects as not logged in sends the user to the login view", async () => {
  stubTodoListApi({}, { rejectAdd: { status: 401, error: "Not logged in" } });

  render(<App />);
  const todoColumn = await screen.findByRole("region", { name: "Todo" });
  fireEvent.change(within(todoColumn).getByLabelText("Description"), { target: { value: "Buy milk" } });
  fireEvent.click(within(todoColumn).getByRole("button", { name: "Add" }));

  expect(await screen.findByLabelText("Username")).toBeDefined();
  expect(screen.queryByRole("region", { name: "Todo" })).toBeNull();
});

it("after the server restarts, a move the server rejects as not logged in sends the user to the login view", async () => {
  stubTodoListApi({ Todo: ["Buy milk"] }, { rejectMove: { status: 401, error: "Not logged in" } });

  render(<App />);
  await within(await screen.findByRole("region", { name: "Todo" })).findByText("Buy milk");
  dragItem("Buy milk", "Todo", regionFor("Doing"));

  expect(await screen.findByLabelText("Username")).toBeDefined();
  expect(screen.queryByRole("region", { name: "Todo" })).toBeNull();
});
