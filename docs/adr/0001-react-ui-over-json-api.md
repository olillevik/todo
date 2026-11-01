# Browser UI as React over a JSON API, not server-rendered HTML

The todo board needs drag-and-drop between columns, and that interaction runs in the browser, so form posts to a server that renders HTML can't carry it. We chose a React + TypeScript UI that calls a TypeScript Node server exposing a JSON API, so the server owns the todo list and the browser owns the interaction. Server-rendered HTML with htmx was rejected because htmx has no drag-and-drop built in, so it would still need a separate drag library and a bridge to the server.
