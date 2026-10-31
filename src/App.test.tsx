// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
