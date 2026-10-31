import { createServer } from "./app";

const PORT = 3001;

createServer().listen(PORT, "127.0.0.1", () => {
  console.log(`API listening on http://127.0.0.1:${PORT}`);
});
