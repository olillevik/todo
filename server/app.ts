import http from "node:http";

export function createServer(): http.Server {
  return http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/api/hello") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Hello from the API" }));
      return;
    }

    res.statusCode = 404;
    res.end();
  });
}
