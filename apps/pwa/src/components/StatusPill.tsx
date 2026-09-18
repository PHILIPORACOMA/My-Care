export function StatusPill(props: { label: string }) {
  return (
    <span className="pill pill-status">
      <span className="dot" aria-hidden="true" />
      {props.label}
    </span>
  );
}
