import { useState, type DragEvent } from "react";
import { AddItemForm } from "./AddItemForm";
import { moveItem, type Column, type ColumnName } from "./api";

const MOVE_FAILED = "Could not move item. Try again.";
// Carries the dragged item's id. A custom type stops browsers from inserting the id as text when
// the item is dropped somewhere that accepts text.
const ITEM_DRAG_TYPE = "application/x-item-id";
// The add form sits at the top of this column, and new items go to its bottom.
const ADD_COLUMN: ColumnName = "Todo";

export function TodoList({
  columns,
  onItemAdded,
  onItemMoved,
  onSessionEnded,
}: {
  columns: Column[];
  onItemAdded: (columns: Column[]) => void;
  onItemMoved: (columns: Column[]) => void;
  onSessionEnded: () => void;
}) {
  const [moveError, setMoveError] = useState("");

  async function requestMove(itemId: string, column: ColumnName) {
    const result = await moveItem(itemId, column);

    if (result.ok) {
      setMoveError("");
      onItemMoved(result.columns);
      return;
    }
    if (result.status === 401) {
      onSessionEnded();
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
    void requestMove(itemId, target.name);
  }

  return (
    <>
      {moveError && <p role="alert">{moveError}</p>}
      <div className="todo-list">
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
            {column.name === ADD_COLUMN && <AddItemForm onAdded={onItemAdded} onSessionEnded={onSessionEnded} />}
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
