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

## Security scan

The security scan uses [trivy](https://trivy.dev). Install it once on your machine:

```sh
brew install trivy
```

Run the scan on demand:

```sh
npm run scan
```

It scans the lockfile (dev dependencies included) and the source for HIGH and CRITICAL vulnerabilities that have a fix, and for secrets. It exits non-zero when it finds one, and it fails with an install hint when trivy is not installed. It skips `node_modules` and `dist`.

## Check

To run the scan, the build and the tests in one command, use `npm run check`. It runs them in that order and exits non-zero if any of them fails. CI runs the same checks as separate jobs, and the scan runs as its own `security-scan` job. Install trivy before you run `npm run check`.
