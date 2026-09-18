import { ApiError } from "@mycare/api-client";
import { Banner, Button, TextField } from "@mycare/ui";
import { useState, type FormEvent } from "react";
import { useAuth } from "../auth";

/** Figure 36, Super Admin – Login. */
export function LoginPage({ wrongRole }: { wrongRole: boolean }) {
  const { login, logout } = useAuth();
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
      setError(e instanceof ApiError ? e.message : "Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="mc-card login-card">
        <div className="login-mark" aria-hidden="true">
          MC
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>My Care</h1>
          <div className="mc-brand-sub">System administration</div>
        </div>

        {wrongRole ? (
          <>
            <Banner tone="warning" title="This console is for the development team">
              Your account is a sub-admin account. Use the Health Worker Portal instead.
            </Banner>
            <Button variant="secondary" onClick={() => void logout()}>
              Sign out
            </Button>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            {error && <Banner tone="danger">{error}</Banner>}
            <TextField label="Email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" busy={busy}>
              Sign in
            </Button>
          </form>
        )}

        <p className="mc-muted mc-small" style={{ margin: 0 }}>
          Restricted to the My Care development team.
        </p>
      </div>
    </div>
  );
}
