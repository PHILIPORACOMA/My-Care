import type { RulesetBundle } from "@mycare/ruleset";
import type {
  AggregateMap,
  AuditCategory,
  AuditPage,
  BarangayOption,
  ConsoleDevice,
  ConsoleUser,
  Dashboard,
  DateRangeParams,
  FieldErrors,
  GenerateReportInput,
  ReportList,
  ReportSummary,
  RulesetContent,
  RulesetVersionSummary,
  StaffUser,
  SymptomCodeEntry,
  SyncStatus,
  SystemHealth,
  Trends,
} from "./types.js";

/**
 * Staff API client for apps/portal and apps/console.
 *
 * Authentication is Sanctum SPA cookie mode (ADR-0004): no token is ever held
 * in JavaScript. The browser carries the session cookie; this client only has
 * to (1) fetch /sanctum/csrf-cookie once, (2) echo the XSRF-TOKEN cookie back
 * as the X-XSRF-TOKEN header on writes, and (3) send credentials. The SPAs are
 * served from the same origin as /api (Vite proxy in development, nginx in
 * production — docs/DEPLOYMENT.md), so there is no CORS in the picture.
 *
 * Deliberately not used by apps/pwa: patients are anonymous and the PWA talks
 * to the device endpoints with a device token.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors: FieldErrors = {}
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** First message for a field, for inline form errors. */
  fieldError(field: string): string | undefined {
    return this.errors[field]?.[0];
  }
}

export interface ClientOptions {
  /** Prefix for every request; "" means same origin. */
  baseUrl?: string;
  /** Called when a request comes back 401, e.g. to show the login screen. */
  onUnauthenticated?: () => void;
  fetch?: typeof fetch;
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export function createClient(options: ClientOptions = {}) {
  const base = options.baseUrl ?? "";
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  let csrfReady = false;

  function xsrfToken(): string | undefined {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]!) : undefined;
  }

  async function ensureCsrf(): Promise<void> {
    if (csrfReady && xsrfToken()) return;
    await doFetch(`${base}/sanctum/csrf-cookie`, { credentials: "include", headers: { Accept: "application/json" } });
    csrfReady = true;
  }

  async function send(method: Method, path: string, body?: unknown, retried = false): Promise<Response> {
    if (method !== "GET") {
      await ensureCsrf();
    }

    const headers: Record<string, string> = { Accept: "application/json" };
    const token = xsrfToken();
    if (token) headers["X-XSRF-TOKEN"] = token;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const response = await doFetch(`${base}${path}`, {
      method,
      credentials: "include",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    // 419: the CSRF token expired with the session. Refresh once and retry.
    if (response.status === 419 && !retried) {
      csrfReady = false;
      return send(method, path, body, true);
    }

    if (!response.ok) {
      let payload: { message?: string; errors?: FieldErrors } = {};
      try {
        payload = await response.json();
      } catch {
        // Not JSON — keep the status alone.
      }
      if (response.status === 401) options.onUnauthenticated?.();
      throw new ApiError(response.status, payload.message ?? `Request failed (${response.status})`, payload.errors ?? {});
    }

    return response;
  }

  async function json<T>(method: Method, path: string, body?: unknown): Promise<T> {
    const response = await send(method, path, body);
    return (await response.json()) as T;
  }

  const query = (params: Record<string, string | number | null | undefined>): string => {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
    return entries.length === 0 ? "" : "?" + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
  };

  return {
    auth: {
      login: (email: string, password: string) =>
        json<{ user: StaffUser }>("POST", "/api/v1/staff/login", { email, password }).then((r) => r.user),
      logout: () => json<{ message: string }>("POST", "/api/v1/staff/logout"),
      me: () => json<{ user: StaffUser }>("GET", "/api/v1/staff/me").then((r) => r.user),
    },

    staff: {
      barangays: () => json<{ barangays: BarangayOption[] }>("GET", "/api/v1/staff/barangays").then((r) => r.barangays),
      dashboard: (params: DateRangeParams & { barangayId?: number | null }) =>
        json<Dashboard>("GET", `/api/v1/staff/dashboard${query({ ...params })}`),
      trends: (barangayId?: number | null) => json<Trends>("GET", `/api/v1/staff/trends${query({ barangayId })}`),
      syncStatus: () => json<SyncStatus>("GET", "/api/v1/staff/sync-status"),
      map: (params: DateRangeParams) => json<AggregateMap>("GET", `/api/v1/staff/map${query({ ...params })}`),
      reports: () => json<ReportList>("GET", "/api/v1/staff/reports"),
      generateReport: (input: GenerateReportInput) =>
        json<{ report: ReportSummary }>("POST", "/api/v1/staff/reports", input).then((r) => r.report),
      /** Fetches the file with the session cookie; the caller saves the Blob. */
      downloadReport: async (id: number): Promise<{ blob: Blob; filename: string }> => {
        const response = await send("GET", `/api/v1/staff/reports/${id}/download`);
        const disposition = response.headers.get("Content-Disposition") ?? "";
        const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? `report-${id}`;
        return { blob: await response.blob(), filename };
      },
    },

    console: {
      systemHealth: () => json<SystemHealth>("GET", "/api/v1/console/system-health"),

      versions: () => json<{ versions: RulesetVersionSummary[] }>("GET", "/api/v1/console/ruleset-versions").then((r) => r.versions),
      version: (id: number) =>
        json<{ version: RulesetVersionSummary; content: RulesetContent }>("GET", `/api/v1/console/ruleset-versions/${id}`),
      createDraft: (baseVersionId?: number) =>
        json<{ version: RulesetVersionSummary }>("POST", "/api/v1/console/ruleset-versions", { baseVersionId }).then((r) => r.version),
      importBundle: (bundle: RulesetBundle) =>
        json<{ version: RulesetVersionSummary }>("POST", "/api/v1/console/ruleset-versions/import", { bundle }).then((r) => r.version),
      saveContent: (id: number, content: RulesetContent) =>
        json<{ version: RulesetVersionSummary }>("PUT", `/api/v1/console/ruleset-versions/${id}/content`, { content }).then((r) => r.version),
      submitForReview: (id: number) =>
        json<{ version: RulesetVersionSummary }>("POST", `/api/v1/console/ruleset-versions/${id}/submit`).then((r) => r.version),
      returnToDraft: (id: number) =>
        json<{ version: RulesetVersionSummary }>("POST", `/api/v1/console/ruleset-versions/${id}/return-to-draft`).then((r) => r.version),
      publish: (id: number, clinicalReviewConfirmed: boolean) =>
        json<{ version: RulesetVersionSummary }>("POST", `/api/v1/console/ruleset-versions/${id}/publish`, { clinicalReviewConfirmed }).then((r) => r.version),
      rollback: (id: number) =>
        json<{ version: RulesetVersionSummary }>("POST", `/api/v1/console/ruleset-versions/${id}/rollback`).then((r) => r.version),

      symptomCodes: () => json<{ symptomCodes: SymptomCodeEntry[] }>("GET", "/api/v1/console/symptom-codes").then((r) => r.symptomCodes),
      createSymptomCode: (entry: Omit<SymptomCodeEntry, "locked">) =>
        json<{ symptomCode: SymptomCodeEntry }>("POST", "/api/v1/console/symptom-codes", entry).then((r) => r.symptomCode),
      updateSymptomCode: (code: string, changes: Partial<Pick<SymptomCodeEntry, "displayName" | "needsClarification">>) =>
        json<{ symptomCode: SymptomCodeEntry }>("PATCH", `/api/v1/console/symptom-codes/${encodeURIComponent(code)}`, changes).then((r) => r.symptomCode),

      users: () => json<{ users: ConsoleUser[] }>("GET", "/api/v1/console/users").then((r) => r.users),
      createSubAdmin: (input: { email: string; password: string; barangayId: number }) =>
        json<{ user: ConsoleUser }>("POST", "/api/v1/console/users", input).then((r) => r.user),
      deactivateUser: (id: number) => json<{ user: ConsoleUser }>("POST", `/api/v1/console/users/${id}/deactivate`).then((r) => r.user),
      setPassword: (id: number, password: string) =>
        json<{ user: ConsoleUser }>("PUT", `/api/v1/console/users/${id}/password`, { password }).then((r) => r.user),
      reassignBarangay: (id: number, barangayId: number) =>
        json<{ user: ConsoleUser }>("PUT", `/api/v1/console/users/${id}/barangay`, { barangayId }).then((r) => r.user),

      devices: () => json<{ devices: ConsoleDevice[] }>("GET", "/api/v1/console/devices").then((r) => r.devices),
      revokeDevice: (id: number) => json<{ approved: boolean }>("POST", `/api/v1/console/devices/${id}/revoke`),
      reinstateDevice: (id: number) => json<{ approved: boolean }>("POST", `/api/v1/console/devices/${id}/reinstate`),

      auditLog: (params: DateRangeParams & { category?: AuditCategory | ""; page?: number }) =>
        json<AuditPage>("GET", `/api/v1/console/audit-logs${query({ ...params })}`),
    },
  };
}

export type ApiClient = ReturnType<typeof createClient>;
