import { ApiError } from "@mycare/api-client";
import { Banner, Button, LoginBrand, PasswordField, TextField } from "@mycare/ui";
import { useState, type FormEvent } from "react";
import { useAuth } from "../auth";

/**
 * Figure 36, Super Admin Login. Same card as the portal's, on the dark ground
 * the design gives the admin subdomain, and with the console's own wording.
 */
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
    <div className="mc-login-page mc-login-dark">
      <div className="mc-login-card">
        <LoginBrand surface="System administration" />

        {wrongRole ? (
          <div className="mc-stack mc-full">
            <Banner tone="warning" title="This console is for the development team">
              Your account is a sub-admin account. Use the Health Worker Portal instead.
            </Banner>
            <Button variant="secondary" onClick={() => void logout()}>
              Sign out
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            {error && <Banner tone="danger">{error}</Banner>}
            <TextField
              label="Email"
              type="email"
              autoComplete="username"
              required
              placeholder="admin@mycare.dev"
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
              Sign in
            </Button>
          </form>
        )}

        <p className="mc-login-foot">Restricted to the My Care development team.</p>
      </div>
    </div>
  );
}
