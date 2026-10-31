import { useEffect, useState } from "react";
import "./App.css";
import { LoginForm } from "./LoginForm";
import { TodoList, type Column } from "./TodoList";

type View = { status: "checking" } | { status: "logged-out" } | { status: "logged-in"; columns: Column[] };

export function App() {
  const [view, setView] = useState<View>({ status: "checking" });

  function loadTodoList() {
    fetch("/api/todo-list")
      .then(async (response) => {
        if (!response.ok) {
          setView({ status: "logged-out" });
          return;
        }
        const body = (await response.json()) as { columns: Column[] };
        setView({ status: "logged-in", columns: body.columns });
      })
      .catch(() => setView({ status: "logged-out" }));
  }

  useEffect(() => {
    loadTodoList();
  }, []);

  return (
    <main>
      <h1>Todo</h1>
      {view.status === "logged-out" && <LoginForm onLoggedIn={loadTodoList} />}
      {view.status === "logged-in" && <TodoList columns={view.columns} />}
    </main>
  );
}
