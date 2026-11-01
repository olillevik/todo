# Todo

A todo list app where a user logs in to see one todo list and move its items between columns. The browser UI is React + TypeScript, and it calls a Node JSON API.

## Run locally

Install dependencies once:

```sh
npm install
```

Start the API and the UI together:

```sh
npm run dev
```

The API runs on http://127.0.0.1:3001 and the UI on http://localhost:5173. Output lines are labelled `api` or `ui`. Ctrl-C stops both.

Open http://localhost:5173. The UI calls `/api/*` on its own port, and Vite forwards those requests to the API.

To run one side on its own, use `npm run dev:api` or `npm run dev:ui`.

## Test and build

```sh
npm test
npm run build
```

To run the build and the tests in one command, use `npm run check`. It runs the build, then the tests, and exits non-zero if either fails. CI runs the same two checks as separate jobs.
