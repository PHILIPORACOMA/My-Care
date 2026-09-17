// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, createClient } from "./client.js";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

describe("createClient", () => {
  beforeEach(() => {
    document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  });

  it("sends credentials and fetches the CSRF cookie before a write", async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push([String(url), init]);
      if (String(url).endsWith("/sanctum/csrf-cookie")) {
        document.cookie = "XSRF-TOKEN=abc%3D";
        return new Response(null, { status: 204 });
      }
      return jsonResponse(200, { user: { id: 1, email: "a@b.c", role: "sub_admin", roleLabel: "Sub Admin", barangayId: 2, barangayName: "X" } });
    });

    const client = createClient({ fetch: fetchMock as unknown as typeof fetch });
    const user = await client.auth.login("a@b.c", "secret");

    expect(user.barangayId).toBe(2);
    expect(calls[0]![0]).toBe("/sanctum/csrf-cookie");
    expect(calls[1]![0]).toBe("/api/v1/staff/login");
    expect(calls[1]![1]!.credentials).toBe("include");
    // The cookie is URL-decoded before being echoed back.
    expect((calls[1]![1]!.headers as Record<string, string>)["X-XSRF-TOKEN"]).toBe("abc=");
  });

  it("turns a 422 into an ApiError carrying field errors", async () => {
    document.cookie = "XSRF-TOKEN=t";
    const fetchMock = vi.fn(async (url: RequestInfo | URL) =>
      String(url).endsWith("csrf-cookie")
        ? new Response(null, { status: 204 })
        : jsonResponse(422, { message: "The submitted data is invalid.", errors: { "rules.0.code": ["Rule code is used twice."] } })
    );

    const client = createClient({ fetch: fetchMock as unknown as typeof fetch });
    const error = await client.console.saveContent(1, { lexiconTerms: [], severityThresholds: [], clarificationQuestions: [], rules: [], healthTips: [] }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(422);
    expect(error.fieldError("rules.0.code")).toBe("Rule code is used twice.");
  });

  it("calls onUnauthenticated on a 401", async () => {
    const onUnauthenticated = vi.fn();
    const client = createClient({
      fetch: (async () => jsonResponse(401, { message: "Unauthenticated." })) as unknown as typeof fetch,
      onUnauthenticated,
    });

    await expect(client.auth.me()).rejects.toThrow("Unauthenticated.");
    expect(onUnauthenticated).toHaveBeenCalledOnce();
  });

  it("refreshes the CSRF token and retries once on a 419", async () => {
    document.cookie = "XSRF-TOKEN=stale";
    let attempts = 0;
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).endsWith("csrf-cookie")) return new Response(null, { status: 204 });
      attempts++;
      return attempts === 1 ? jsonResponse(419, { message: "CSRF token mismatch." }) : jsonResponse(200, { message: "Signed out." });
    });

    const client = createClient({ fetch: fetchMock as unknown as typeof fetch });
    await expect(client.auth.logout()).resolves.toEqual({ message: "Signed out." });
    expect(attempts).toBe(2);
  });

  it("omits empty query parameters", async () => {
    const urls: string[] = [];
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      urls.push(String(url));
      return jsonResponse(200, {});
    });
    const client = createClient({ fetch: fetchMock as unknown as typeof fetch });

    await client.staff.dashboard({ from: "2026-09-01", to: "2026-09-17", barangayId: null });

    expect(urls[0]).toBe("/api/v1/staff/dashboard?from=2026-09-01&to=2026-09-17");
  });
});
