import type { AddressInfo } from "node:net";
import { expect, it } from "vitest";
import { createServer } from "./app";

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
