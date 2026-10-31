import { useState, type FormEvent } from "react";
import type { Column } from "./TodoList";

const ADD_FAILED = "Could not add item. Try again.";

export function AddItemForm({ onAdded }: { onAdded: (columns: Column[]) => void }) {
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/todo-list/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    }).catch(() => null);

    if (response?.ok) {
      const body = (await response.json()) as { columns: Column[] };
      setDescription("");
      setError("");
      onAdded(body.columns);
      return;
    }

    const body = response ? ((await response.json().catch(() => null)) as { error?: string } | null) : null;
    setError(body?.error ?? ADD_FAILED);
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Description{" "}
        <input name="description" value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      <button type="submit">Add</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
