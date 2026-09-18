import { ApiError } from "@mycare/api-client";
import { Banner, Button, LoginBrand, PasswordField, TextField } from "@mycare/ui";
import { useState, type FormEvent } from "react";
import { useAuth } from "../auth";

/**
 * Figure 30, Sub Admin Portal Login. Copy and layout follow the design canvas:
 * brand block, email, password with a Show toggle, "Log in", and the line
 * about who creates accounts.
 */
export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await login(email, password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mc-login-page">
      <div className="mc-login-card">
        <LoginBrand surface="Health worker portal" />

        <form onSubmit={submit} noValidate>
          {error && <Banner tone="danger">{error}</Banner>}
          <TextField
            label="Email"
            type="email"
            autoComplete="username"
            required
            placeholder="worker@rhu.gov.ph"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <PasswordField
            label="Password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" busy={busy}>
            Log in
          </Button>
        </form>

        <p className="mc-login-foot">Accounts are created by the system administrator.</p>
      </div>
    </div>
  );
}
