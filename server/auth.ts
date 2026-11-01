import { createHash, timingSafeEqual } from "node:crypto";

// Hardcoded test account. For testing only: user management is deferred, and this must be
// replaced before any production use (see the security-review note in issue #1).
export const TEST_USERNAME = "orjan";
export const TEST_PASSWORD = "password";

// Hashing both sides gives equal-length buffers for timingSafeEqual, so length does not leak.
function sameText(actual: unknown, expected: string): boolean {
  if (typeof actual !== "string") return false;
  const actualHash = createHash("sha256").update(actual).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

export function isValidLogin(username: unknown, password: unknown): boolean {
  // Both checks always run, so the response time does not reveal which field was wrong.
  const usernameMatches = sameText(username, TEST_USERNAME);
  const passwordMatches = sameText(password, TEST_PASSWORD);
  return usernameMatches && passwordMatches;
}
