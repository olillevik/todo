import { useState, type FormEvent } from "react";
import { login } from "./api";

const INVALID_LOGIN = "Invalid username or password";
const LOGIN_FAILED = "Could not log in. Try again.";

export function LoginForm({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await login(String(form.get("username") ?? ""), String(form.get("password") ?? ""));

    if (result.ok) {
      onLoggedIn();
      return;
    }
    setError(result.status === 401 ? INVALID_LOGIN : LOGIN_FAILED);
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Username <input name="username" autoComplete="username" />
      </label>
      <label>
        Password <input name="password" type="password" autoComplete="current-password" />
      </label>
      <button type="submit">Log in</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
