import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const hookPath = resolve(dirname(fileURLToPath(import.meta.url)), "../.githooks/pre-push");

// Stands in for npm so the hook can be tested without running the real checks (which would run this test again).
// It records where it ran and what it was asked, prints a line the hook must not swallow, and exits with FAKE_NPM_EXIT.
const fakeNpm = `#!/bin/sh
echo "ran: npm $* in $(pwd -P)"
echo "output from npm $*"
exit "\${FAKE_NPM_EXIT:-0}"
`;

let workDir: string;
let repoDir: string;
let binDir: string;

// git sets GIT_* variables while a hook runs (a push runs this test that way), and they would point git at the
// outer repo instead of the temp repo. So every git call here runs without them.
function cleanEnv(): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
}

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "pre-push-test-"));
  repoDir = join(workDir, "repo");
  binDir = join(workDir, "bin");
  mkdirSync(repoDir);
  mkdirSync(binDir);
  spawnSync("git", ["init", "-q"], { cwd: repoDir, env: cleanEnv() });
  writeFileSync(join(binDir, "npm"), fakeNpm);
  chmodSync(join(binDir, "npm"), 0o755);
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

// Runs the hook the way git does: the ref list arrives on stdin.
function runHook(cwd: string, npmExitCode: number) {
  const env = cleanEnv();
  return spawnSync(hookPath, [], {
    cwd,
    input: "refs/heads/main 1111111 refs/heads/main 2222222\n",
    encoding: "utf8",
    env: {
      ...env,
      PATH: `${binDir}:${env.PATH ?? ""}`,
      FAKE_NPM_EXIT: String(npmExitCode),
    },
  });
}

describe("pre-push hook", () => {
  it("runs npm run check from the repo root and lets the push through when it passes", () => {
    const result = runHook(repoDir, 0);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`ran: npm run check in ${realpathSync(repoDir)}`);
  });

  it("runs npm run check from the repo root even when the push starts in a subdirectory", () => {
    const subdir = join(repoDir, "server");
    mkdirSync(subdir);

    const result = runHook(subdir, 0);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`ran: npm run check in ${realpathSync(repoDir)}`);
  });

  it("stops the push when the check fails, shows the check output, and says so in one line", () => {
    const result = runHook(repoDir, 1);

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("output from npm run check");
    expect(result.stderr).toMatch(/push stopped.*failing check is shown above/);
  });
});
