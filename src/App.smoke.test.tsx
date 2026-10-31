// @vitest-environment jsdom
// Smoke test: the UI against the real server, with no fake replies in between. The UI's relative
// /api URLs go to a real HTTP server on a free port, the way the dev proxy forwards them in the
// browser. This catches a drift between the client and the server that the mocked tests cannot see.
import type { AddressInfo } from "node:net";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createServer } from "../server/app";
import { TEST_PASSWORD, TEST_USERNAME } from "../server/auth";
import { App } from "./App";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function startServer() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

// Stands in for the dev proxy and the browser's cookie jar. Relative /api URLs are sent to the real
// server, and the session cookie it sets is sent back on every later request.
function routeApiTo(baseUrl: string) {
  const realFetch = globalThis.fetch;
  let cookie: string | undefined;
  vi.stubGlobal("fetch", async (input: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (cookie) headers.set("Cookie", cookie);
    const response = await realFetch(new URL(input, baseUrl), { ...init, headers });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    return response;
  });
}

// jsdom has no DataTransfer, so this stand-in carries the drag data from dragstart to drop.
function dataTransferStub() {
  const data = new Map<string, string>();
  return {
    dropEffect: "none",
    effectAllowed: "uninitialized",
    setData: (type: string, value: string) => void data.set(type, value),
    getData: (type: string) => data.get(type) ?? "",
  };
}

function dragItem(description: string, toColumn: string) {
  const dataTransfer = dataTransferStub();
  fireEvent.dragStart(screen.getByText(description), { dataTransfer });
  fireEvent.dragOver(screen.getByRole("region", { name: toColumn }), { dataTransfer });
  fireEvent.drop(screen.getByRole("region", { name: toColumn }), { dataTransfer });
}

it("log in, add an item, move it, and find it after a reload, against the real server", async () => {
  const server = await startServer();
  routeApiTo(server.baseUrl);

  try {
    render(<App />);
    fireEvent.change(await screen.findByLabelText("Username"), { target: { value: TEST_USERNAME } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: TEST_PASSWORD } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    const todo = await screen.findByRole("region", { name: "Todo" });
    fireEvent.change(within(todo).getByLabelText("Description"), { target: { value: "Buy milk" } });
    fireEvent.click(within(todo).getByRole("button", { name: "Add" }));
    await within(todo).findByText("Buy milk");

    dragItem("Buy milk", "Doing");
    await within(await screen.findByRole("region", { name: "Doing" })).findByText("Buy milk");
    expect(within(screen.getByRole("region", { name: "Todo" })).queryByText("Buy milk")).toBeNull();

    // A reload: a fresh App with the same session cookie. The board must come back from the server.
    cleanup();
    render(<App />);
    await within(await screen.findByRole("region", { name: "Doing" })).findByText("Buy milk");
    expect(within(screen.getByRole("region", { name: "Todo" })).queryByText("Buy milk")).toBeNull();
  } finally {
    await server.stop();
  }
});
