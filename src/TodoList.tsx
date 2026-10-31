import { AddItemForm } from "./AddItemForm";

export type Item = { description: string };
export type Column = { name: string; items: Item[] };

export function TodoList({
  columns,
  onItemAdded,
}: {
  columns: Column[];
  onItemAdded: (columns: Column[]) => void;
}) {
  return (
    <div className="board">
      {columns.map((column) => (
        <section key={column.name} aria-label={column.name} className="column">
          <h2>{column.name}</h2>
          {column.name === "Todo" && <AddItemForm onAdded={onItemAdded} />}
          <ul>
            {column.items.map((item, index) => (
              <li key={index}>{item.description}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
