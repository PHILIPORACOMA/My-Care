import { createClient } from "@mycare/api-client";

/** Listeners told when the session ends, so the app can return to sign-in. */
const unauthenticatedListeners = new Set<() => void>();

export const api = createClient({
  onUnauthenticated: () => unauthenticatedListeners.forEach((listener) => listener()),
});

export function onUnauthenticated(listener: () => void): () => void {
  unauthenticatedListeners.add(listener);
  return () => unauthenticatedListeners.delete(listener);
}
