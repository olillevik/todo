import { useEffect, useState } from "react";
import "./App.css";
import { getTodoList, type Column } from "./api";
import { LoginForm } from "./LoginForm";
import { TodoList } from "./TodoList";

type View = { status: "checking" } | { status: "logged-out" } | { status: "logged-in"; columns: Column[] };

export function App() {
  const [view, setView] = useState<View>({ status: "checking" });

  // Any failure to load the todo list means the user needs to log in.
  function loadTodoList() {
    getTodoList()
      .then((result) =>
        setView(result.ok ? { status: "logged-in", columns: result.columns } : { status: "logged-out" }),
      )
      .catch(() => setView({ status: "logged-out" }));
  }

  useEffect(() => {
    loadTodoList();
  }, []);

  function showColumns(columns: Column[]) {
    setView({ status: "logged-in", columns });
  }

  // The server no longer knows the session, for example after it restarted.
  function showLoginForm() {
    setView({ status: "logged-out" });
  }

  return (
    <main>
      <h1>Todo</h1>
      {view.status === "logged-out" && <LoginForm onLoggedIn={loadTodoList} />}
      {view.status === "logged-in" && (
        <TodoList
          columns={view.columns}
          onItemAdded={showColumns}
          onItemMoved={showColumns}
          onSessionEnded={showLoginForm}
        />
      )}
    </main>
  );
}
