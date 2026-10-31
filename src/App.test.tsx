// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "./App";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("shows the reply from the API", async () => {
  const fetchMock = vi.fn(async () => Response.json({ message: "Hello from the API" }));
  vi.stubGlobal("fetch", fetchMock);

  render(<App />);

  expect(await screen.findByText("Hello from the API")).toBeDefined();
  expect(fetchMock).toHaveBeenCalledWith("/api/hello");
});
