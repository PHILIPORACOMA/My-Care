import type {
  ClarificationQuestion,
  HealthTip,
  LexiconTerm,
  SeverityThreshold,
  Tier,
  TriageRule,
} from "@mycare/ruleset";

/**
 * Response shapes of apps/api's staff and console endpoints. Kept beside the
 * client that fetches them; the PHP controllers are the source of truth.
 */

/**
 * A count as the API sends it (SuppressionRule::cell). `value` is null whenever
 * the bucket is under 5 — the raw number is never in the payload.
 */
export interface Cell {
  display: string;
  suppressed: boolean;
  value: number | null;
}

export type TierCells = Record<Tier, Cell>;

export interface StaffUser {
  id: number;
  email: string;
  role: "super_admin" | "sub_admin" | null;
  roleLabel: string | null;
  barangayId: number | null;
  barangayName: string | null;
}

export interface DateRangeParams {
  from?: string;
  to?: string;
}

export interface BarangayOption {
  id: number;
  name: string;
}

export interface Dashboard {
  range: { from: string; to: string };
  total: Cell;
  tiers: TierCells;
  topSymptoms: { code: string; displayName: string; count: Cell }[];
  computedAt: string | null;
}

export interface TrendEntry {
  symptomCode: string;
  displayName: string;
  tier: Tier | null;
  currentWeek: Cell;
  changePercent: number | null;
}

export interface Trends {
  series: { date: string; total: Cell; tiers: TierCells }[];
  clusters: TrendEntry[];
  currentWeek: { from: string; to: string };
  watchList: (TrendEntry & { state: "rising" | "stable" | "low" })[];
  computedAt: string | null;
}

export interface SyncStatus {
  lastSyncAt: string | null;
  isCurrent: boolean;
  devices: {
    total: number;
    reportedLast24h: number;
    reportedLast7d: number;
    byType: Record<string, number>;
  };
  pendingUploads: { sessions: Cell; devicesNotReporting: number };
  sessions: { last7Days: Cell; total: Cell };
  lastBatchAt: string | null;
  barangays: { id: number; name: string; devices: number; reportedLast7d: number; lastSyncAt: string | null }[];
}

export type MapBand = "low" | "elevated" | "high" | "suppressed";

export interface AggregateMap {
  range: { from: string; to: string };
  barangays: { id: number; name: string; total: Cell; band: MapBand }[];
}

export interface ReportSummary {
  id: number;
  type: string;
  label: string;
  format: "csv" | "pdf";
  barangayName: string | null;
  from: string;
  to: string;
  fileSizeKb: number;
  generatedBy: string | null;
  generatedAt: string;
}

export interface ReportList {
  types: { key: string; label: string }[];
  reports: ReportSummary[];
}

export interface GenerateReportInput {
  type: string;
  format: "csv" | "pdf";
  from: string;
  to: string;
  barangayId?: number | null;
}

/* ----------------------------------------------------------------- console */

export type RulesetStatus = "draft" | "superseded" | "in_review" | "published" | "retired";

export interface RulesetVersionSummary {
  id: number;
  label: string;
  status: RulesetStatus;
  publishedAt: string | null;
  publishedBy: string | null;
  counts?: {
    rules: number;
    lexiconTerms: number;
    severityThresholds: number;
    clarificationQuestions: number;
    healthTips: number;
  };
}

/** The version-scoped part of a RulesetBundle — what the console edits. */
export interface RulesetContent {
  lexiconTerms: LexiconTerm[];
  severityThresholds: SeverityThreshold[];
  clarificationQuestions: ClarificationQuestion[];
  rules: TriageRule[];
  healthTips: HealthTip[];
}

export interface SymptomCodeEntry {
  code: string;
  displayName: string;
  needsClarification: boolean;
  locked: boolean;
}

export interface ConsoleUser extends StaffUser {
  status: "active" | "deactivated";
  createdAt: string | null;
}

export interface ConsoleDevice {
  id: number;
  label: string;
  type: string;
  barangayId: number;
  barangayName: string | null;
  approved: boolean;
  status: string;
  registeredAt: string | null;
  lastSyncAt: string | null;
  pendingSessions: number | null;
}

export type AuditCategory = "rules" | "accounts" | "sign-in" | "exports" | "devices" | "reference" | "other";

export interface AuditEntry {
  id: number;
  createdAt: string;
  actorId: number | null;
  actorLabel: string;
  category: AuditCategory;
  actionType: string;
  targetTable: string;
  targetId: number | null;
  oldValue: Record<string, unknown> | null;
}

export interface AuditPage {
  entries: AuditEntry[];
  page: number;
  lastPage: number;
  total: number;
}

export type ServiceStatus = "ok" | "degraded" | "down";

export interface SystemHealth {
  appVersion: string;
  checkedAt: string;
  services: { key: string; label: string; status: ServiceStatus; detail: string }[];
  metrics: {
    barangaysLive: number;
    barangaysTotal: number;
    devicesApproved: number;
    devicesReportedLast7d: number;
    activeSubAdmins: number;
    syncQueue: { pendingSessions: Cell; devicesNotReporting: number };
    batchesLast24h: number;
    sessionsLast24h: Cell;
    activeFacilities: number;
  };
  publishedVersion: { label: string; publishedAt: string | null } | null;
  lastAggregation: {
    finishedAt: string;
    sessions: number;
    rows: number;
    replayFailures: number;
    deviceDisagreements: number;
  } | null;
  barangays: { id: number; name: string; devices: number; lastSyncAt: string | null }[];
}

/** Validation errors from a 422, keyed by field path. */
export type FieldErrors = Record<string, string[]>;
