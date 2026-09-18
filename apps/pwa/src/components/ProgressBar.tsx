export function ProgressBar(props: { step: number; total: number; label: string }) {
  return (
    <div>
      <div className="progress-bar">
        {Array.from({ length: props.total }, (_, index) => (
          <div
            key={index}
            className={index < props.step ? "progress-segment progress-segment-filled" : "progress-segment"}
          />
        ))}
      </div>
      <p className="progress-label">{props.label}</p>
    </div>
  );
}
