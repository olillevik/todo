export type Column = { name: string };

export function TodoList({ columns }: { columns: Column[] }) {
  return (
    <div className="board">
      {columns.map((column) => (
        <section key={column.name} aria-label={column.name} className="column">
          <h2>{column.name}</h2>
          <ul />
        </section>
      ))}
    </div>
  );
}
