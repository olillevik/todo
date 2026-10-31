import { useState, type DragEvent } from "react";
import { AddItemForm } from "./AddItemForm";

export type Item = { id: string; description: string };
export type Column = { name: string; items: Item[] };

const MOVE_FAILED = "Could not move item. Try again.";
// Carries the dragged item's id. A custom type stops browsers from inserting the id as text when
// the item is dropped somewhere that accepts text.
const ITEM_DRAG_TYPE = "application/x-todo-item";

export function TodoList({
  columns,
  onItemAdded,
  onItemMoved,
}: {
  columns: Column[];
  onItemAdded: (columns: Column[]) => void;
  onItemMoved: (columns: Column[]) => void;
}) {
  const [moveError, setMoveError] = useState("");

  async function moveItem(itemId: string, columnName: string) {
    const response = await fetch(`/api/todo-list/items/${itemId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ column: columnName }),
    }).catch(() => null);

    if (response?.ok) {
      const body = (await response.json()) as { columns: Column[] };
      setMoveError("");
      onItemMoved(body.columns);
      return;
    }
    setMoveError(MOVE_FAILED);
  }

  function handleDrop(event: DragEvent<HTMLElement>, target: Column) {
    event.preventDefault();
    const itemId = event.dataTransfer.getData(ITEM_DRAG_TYPE);
    const source = columns.find((column) => column.items.some((item) => item.id === itemId));
    // Nothing moves for something that is not an item on this list, or for a drop on the item's own column.
    if (!source || source.name === target.name) return;
    void moveItem(itemId, target.name);
  }

  return (
    <>
      {moveError && <p role="alert">{moveError}</p>}
      <div className="board">
        {columns.map((column) => (
          <section
            key={column.name}
            aria-label={column.name}
            className="column"
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={(event) => handleDrop(event, column)}
          >
            <h2>{column.name}</h2>
            {column.name === "Todo" && <AddItemForm onAdded={onItemAdded} />}
            <ul>
              {column.items.map((item) => (
                <li
                  key={item.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData(ITEM_DRAG_TYPE, item.id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                >
                  {item.description}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
