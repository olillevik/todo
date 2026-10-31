# Todo

A todo board where a user logs in to see one todo list and move its items between columns. The browser UI is React + TypeScript, and it calls a Node JSON API.

## Run locally

Install dependencies once:

```sh
npm install
```

Start the API on http://127.0.0.1:3001 in one terminal:

```sh
npm run dev:api
```

Start the UI in another terminal:

```sh
npm run dev:ui
```

Open http://localhost:5173. The UI calls `/api/*` on its own port, and Vite forwards those requests to the API.

## Test and build

```sh
npm test
npm run build
```
