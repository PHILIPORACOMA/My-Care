import type { Cell } from "@mycare/api-client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

/* ------------------------------------------------------------------ layout */

export interface NavItem {
  to: string;
  label: string;
}

/**
 * The two staff surfaces share this shell. `sidebar="dark"` is the console
 * (Figure 37): a dark sidebar beside a light content area — not a dark theme.
 * Only the sidebar's tokens change.
 */
export function AppShell(props: {
  brand: string;
  subtitle: string;
  mark: ReactNode;
  nav: NavItem[];
  renderLink: (item: NavItem) => ReactNode;
  sidebar?: "light" | "dark";
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mc-shell" data-sidebar={props.sidebar ?? "light"}>
      <aside className="mc-sidebar">
        <div className="mc-brand">
          <div className="mc-brand-mark" aria-hidden="true">
            {props.mark}
          </div>
          <div>
            <div className="mc-brand-name">{props.brand}</div>
            <div className="mc-brand-sub">{props.subtitle}</div>
          </div>
        </div>
        <nav className="mc-nav" aria-label="Main">
          {props.nav.map((item) => (
            <span key={item.to} style={{ display: "contents" }}>
              {props.renderLink(item)}
            </span>
          ))}
        </nav>
        {props.footer && <div className="mc-sidebar-foot">{props.footer}</div>}
      </aside>
      <main className="mc-main">{props.children}</main>
    </div>
  );
}

export function PageHeader(props: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mc-page-header">
      <div>
        <h1>{props.title}</h1>
        {props.subtitle && <p>{props.subtitle}</p>}
      </div>
      {props.actions && <div className="mc-actions">{props.actions}</div>}
    </header>
  );
}

export function Card(props: { title?: ReactNode; aside?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={cx("mc-card", props.className)}>
      {(props.title || props.aside) && (
        <div className="mc-card-header">
          {props.title && <h2 className="mc-card-title">{props.title}</h2>}
          {props.aside}
        </div>
      )}
      {props.children}
    </section>
  );
}

/* ---------------------------------------------------------------- numbers */

export const MASK_EXPLANATION = "Fewer than 5 sessions. Hidden to protect patient privacy.";

/**
 * Renders an API count cell. A suppressed cell shows "<5" with an explanation;
 * the raw value is not available to render even by mistake — the API sends
 * null (SuppressionRule::cell).
 */
export function Count({ cell }: { cell: Cell }) {
  if (cell.suppressed) {
    return (
      <span className="mc-count mc-count-masked" title={MASK_EXPLANATION}>
        {cell.display}
        <span className="mc-visually-hidden"> — {MASK_EXPLANATION}</span>
      </span>
    );
  }
  return <span className="mc-count">{cell.display}</span>;
}

const DELTA_CLASS = {
  good: "mc-delta-up-good",
  warn: "mc-delta-up-warn",
  flat: "mc-delta-flat",
} as const;

export function StatCard(props: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "home" | "rhu" | "emergency" | "accent";
  /** Figure 31's "▲ 12% vs last week" line under the figure. */
  delta?: { text: string; tone?: "good" | "warn" | "flat" };
}) {
  return (
    <div className={cx("mc-card", "mc-stat", props.tone && `mc-tone-${props.tone}`)}>
      <span className="mc-stat-label">{props.label}</span>
      <span className="mc-stat-value">{props.value}</span>
      {props.delta && <span className={DELTA_CLASS[props.delta.tone ?? "good"]}>{props.delta.text}</span>}
      {props.hint && <span className="mc-stat-hint">{props.hint}</span>}
    </div>
  );
}

/**
 * A ranked list with proportional bars (Figure 31, "Top symptom codes").
 *
 * Only displayable counts reach this: a suppressed bucket has no bar, because
 * a bar's length would give away the count the mask exists to hide.
 */
export function RankList(props: { items: { key: string; name: ReactNode; value: number; display: string }[] }) {
  const top = Math.max(1, ...props.items.map((i) => i.value));

  return (
    <div>
      {props.items.map((item, index) => (
        <div className="mc-rank" key={item.key}>
          <span className="mc-rank-index">{index + 1}</span>
          <span className="mc-rank-name">{item.name}</span>
          <span className="mc-rank-track" aria-hidden="true">
            <span style={{ width: `${Math.round((item.value / top) * 100)}%` }} />
          </span>
          <span className="mc-rank-value">{item.display}</span>
        </div>
      ))}
    </div>
  );
}

/** The segmented range switch in Figure 31. */
export function Segmented<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="mc-segment" role="group" aria-label={props.label}>
      {props.options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={props.value === option.value}
          onClick={() => props.onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Figure 31's "As of last sync" pill. */
export function SyncPill({ children }: { children: ReactNode }) {
  return <span className="mc-pill">{children}</span>;
}

export type BadgeTone = "home" | "rhu" | "emergency" | "ok" | "warn" | "danger" | "info" | "neutral";

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={cx("mc-badge", tone !== "neutral" && `mc-badge-${tone}`)}>{children}</span>;
}

export const TIER_LABELS = {
  home: "Home management",
  rhu: "RHU referral",
  emergency: "Emergency referral",
} as const;

export function TierBadge({ tier }: { tier: keyof typeof TIER_LABELS }) {
  return <Badge tone={tier}>{TIER_LABELS[tier]}</Badge>;
}

/* ----------------------------------------------------------------- buttons */

export function Button({
  variant = "primary",
  size,
  busy,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm";
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cx("mc-button", variant !== "primary" && `mc-button-${variant}`, size && `mc-button-${size}`, rest.className)}
    >
      {busy && <span className="mc-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------- forms */

function FieldShell(props: { label: ReactNode; error?: string; hint?: ReactNode; id: string; children: ReactNode }) {
  return (
    <label className="mc-field" htmlFor={props.id}>
      <span>{props.label}</span>
      {props.children}
      {props.hint && !props.error && <small className="mc-field-hint">{props.hint}</small>}
      {props.error && (
        <small className="mc-field-error" id={`${props.id}-error`} role="alert">
          {props.error}
        </small>
      )}
    </label>
  );
}

export function TextField({
  label,
  error,
  hint,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; error?: string; hint?: ReactNode }) {
  const generated = useId();
  const id = input.id ?? generated;
  return (
    <FieldShell label={label} error={error} hint={hint} id={id}>
      <input
        {...input}
        id={id}
        className={cx("mc-input", input.className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
    </FieldShell>
  );
}

/**
 * Password field with the "Show" toggle both login screens have (Figures 30,
 * 36). The toggle is a real button, announced as such, and the field keeps its
 * autocomplete semantics.
 */
export function PasswordField({
  label,
  error,
  hint,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; error?: string; hint?: ReactNode }) {
  const generated = useId();
  const id = input.id ?? generated;
  const [visible, setVisible] = useState(false);

  return (
    <FieldShell label={label} error={error} hint={hint} id={id}>
      <div className="mc-input-affix">
        <input
          {...input}
          id={id}
          type={visible ? "text" : "password"}
          className={cx("mc-input", input.className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <button type="button" className="mc-input-action" onClick={() => setVisible((v) => !v)} aria-pressed={visible}>
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </FieldShell>
  );
}

export function SelectField({
  label,
  error,
  hint,
  children,
  ...select
}: SelectHTMLAttributes<HTMLSelectElement> & { label: ReactNode; error?: string; hint?: ReactNode }) {
  const generated = useId();
  const id = select.id ?? generated;
  return (
    <FieldShell label={label} error={error} hint={hint} id={id}>
      <select {...select} id={id} className={cx("mc-select", select.className)} aria-invalid={error ? true : undefined}>
        {children}
      </select>
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  error,
  hint,
  ...area
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: ReactNode; error?: string; hint?: ReactNode }) {
  const generated = useId();
  const id = area.id ?? generated;
  return (
    <FieldShell label={label} error={error} hint={hint} id={id}>
      <textarea {...area} id={id} className={cx("mc-textarea", area.className)} aria-invalid={error ? true : undefined} />
    </FieldShell>
  );
}

export function Checkbox(props: { checked: boolean; onChange: (checked: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return (
    <label className="mc-check">
      <input type="checkbox" checked={props.checked} disabled={props.disabled} onChange={(e) => props.onChange(e.target.checked)} />
      <span>{props.children}</span>
    </label>
  );
}

/* ------------------------------------------------------------------ states */

export function Banner(props: {
  tone?: "info" | "success" | "warning" | "danger";
  title?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const tone = props.tone ?? "info";
  return (
    <div className={cx("mc-banner", `mc-banner-${tone}`, props.className)} role={tone === "danger" || tone === "warning" ? "alert" : "status"}>
      <div>
        {props.title && <strong>{props.title}</strong>}
        {props.children}
      </div>
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <span role="status" className="mc-row mc-muted">
      <span className="mc-spinner" aria-hidden="true" />
      <span>{label}…</span>
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="mc-empty">{children}</div>;
}

/** Loading / error / content, the three states every screen has. */
export function Async<T>(props: {
  state: { data: T | undefined; error: Error | undefined; loading: boolean; reload: () => void };
  children: (data: T) => ReactNode;
}) {
  const { data, error, loading, reload } = props.state;
  if (error) {
    return (
      <Banner tone="danger" title="Could not load this view">
        <p style={{ margin: "4px 0 8px" }}>{error.message}</p>
        <Button variant="secondary" size="sm" onClick={reload}>
          Try again
        </Button>
      </Banner>
    );
  }
  if (loading && data === undefined) {
    return <Spinner />;
  }
  return <>{data !== undefined && props.children(data)}</>;
}

/* ------------------------------------------------------------------ table */

export interface Column<Row> {
  key: string;
  header: ReactNode;
  render: (row: Row) => ReactNode;
  numeric?: boolean;
}

export function DataTable<Row>(props: {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string | number;
  empty?: ReactNode;
  caption?: string;
}) {
  if (props.rows.length === 0) {
    return <EmptyState>{props.empty ?? "Nothing to show yet."}</EmptyState>;
  }
  return (
    <div className="mc-table-wrap">
      <table className="mc-table">
        {props.caption && <caption className="mc-visually-hidden">{props.caption}</caption>}
        <thead>
          <tr>
            {props.columns.map((c) => (
              <th key={c.key} scope="col" className={c.numeric ? "mc-num" : undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row) => (
            <tr key={props.rowKey(row)}>
              {props.columns.map((c) => (
                <td key={c.key} className={c.numeric ? "mc-num" : undefined}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ dialog */

export function Dialog(props: {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (props.open && !dialog.open) {
      dialog.showModal?.();
      if (!dialog.showModal) dialog.setAttribute("open", "");
    } else if (!props.open && dialog.open) {
      dialog.close?.();
      dialog.removeAttribute("open");
    }
  }, [props.open]);

  return (
    <dialog ref={ref} className="mc-dialog" onClose={props.onClose} onCancel={props.onClose}>
      {props.open && (
        <>
          <div className="mc-dialog-body">
            <h2>{props.title}</h2>
            {props.children}
          </div>
          <div className="mc-dialog-foot">{props.footer}</div>
        </>
      )}
    </dialog>
  );
}
