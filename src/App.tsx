import { useEffect, useState } from "react";

export function App() {
  const [reply, setReply] = useState("");

  useEffect(() => {
    fetch("/api/hello")
      .then((response) => response.json())
      .then((body: { message: string }) => setReply(body.message));
  }, []);

  return (
    <main>
      <h1>Todo</h1>
      <p>{reply}</p>
    </main>
  );
}
