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

## Lint, test and build

```sh
npm run lint
npm test
npm run build
```

`npm run lint` runs Biome over the whole repo. Warnings count as failures too.

## Security scan

The security scan uses [trivy](https://trivy.dev). Install it once on your machine:

```sh
brew install trivy
```

CI pins trivy 0.76.1. Keep the local install at that version, because `brew install trivy` installs whatever version Homebrew currently has.

Run the scan on demand:

```sh
npm run scan
```

It scans the lockfile (dev dependencies included) and the source for HIGH and CRITICAL vulnerabilities that have a fix, and for secrets. It exits non-zero when it finds one, and it fails with an install hint when trivy is not installed. It skips `node_modules` and `dist`.

## Check

To run lint, the scan, the build and the tests in one command, use `npm run check`. It runs them in that order and exits non-zero if any of them fails. Install trivy before you run `npm run check`. CI runs the same checks as separate jobs: `lint`, `build`, `test` and `security-scan`.

## Pre-push hook

The repo has an opt-in git hook, `.githooks/pre-push`, that runs `npm run check` before every push. If the check fails, the push is stopped and the output shows which check failed. The hook needs trivy installed, the same as `npm run check`.

To install it in your clone, run this from the repo root:

```sh
cp .githooks/pre-push "$(git rev-parse --git-common-dir)/hooks/pre-push"
```

The copy goes into this clone's own `.git/hooks` and is not linked to `.githooks/pre-push`, so run the copy again after that file changes.

The hook can be skipped with `git push --no-verify`, so it is a check, not a lock. CI runs the same checks on every pull request, and merging is gated on those checks once branch protection requires them.
