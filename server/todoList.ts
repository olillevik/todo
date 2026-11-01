import { randomUUID } from "node:crypto";

const COLUMN_NAMES = ["Todo", "Doing", "Done"] as const;
type ColumnName = (typeof COLUMN_NAMES)[number];

export function isColumnName(value: unknown): value is ColumnName {
  return COLUMN_NAMES.some((name) => name === value);
}

// New items go to the bottom of this column.
const ADD_COLUMN: ColumnName = "Todo";

// The id is internal to the server: it gives a move a stable target, since an item's position changes.
type Item = { id: string; description: string };
type Column = { name: ColumnName; items: Item[] };

// The one todo list. It starts empty, and it lives only as long as this instance.
export function createTodoList() {
  const itemsByColumn: Record<ColumnName, Item[]> = { Todo: [], Doing: [], Done: [] };

  function locate(itemId: string): { column: ColumnName; index: number } | undefined {
    for (const column of COLUMN_NAMES) {
      const index = itemsByColumn[column].findIndex((item) => item.id === itemId);
      if (index !== -1) return { column, index };
    }
    return undefined;
  }

  return {
    reply(): { columns: Column[] } {
      return { columns: COLUMN_NAMES.map((name) => ({ name, items: itemsByColumn[name] })) };
    },

    hasItem(itemId: string): boolean {
      return locate(itemId) !== undefined;
    },

    add(description: string): void {
      itemsByColumn[ADD_COLUMN].push({ id: randomUUID(), description });
    },

    // Moving an item to the column it is already in changes nothing.
    move(itemId: string, target: ColumnName): void {
      const found = locate(itemId);
      if (!found || found.column === target) return;
      itemsByColumn[target].push(...itemsByColumn[found.column].splice(found.index, 1));
    },
  };
}
