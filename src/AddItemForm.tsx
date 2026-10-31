import { useState, type FormEvent } from "react";
import { addItem, type Column } from "./api";

const ADD_FAILED = "Could not add item. Try again.";

export function AddItemForm({
  onAdded,
  onSessionEnded,
}: {
  onAdded: (columns: Column[]) => void;
  onSessionEnded: () => void;
}) {
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await addItem(description);

    if (result.ok) {
      setDescription("");
      setError("");
      onAdded(result.columns);
      return;
    }
    if (result.status === 401) {
      onSessionEnded();
      return;
    }
    setError(result.error ?? ADD_FAILED);
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
