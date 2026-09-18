import { useState } from "react";
import type { LanguageCode } from "@mycare/ruleset";
import { ProgressBar } from "../../components/ProgressBar.js";
import { ScreenHeader } from "../../components/ScreenHeader.js";
import { Icon } from "../../components/Icon.js";

/**
 * Placeholder list — replace with the real LGU/RHU barangay list once that
 * data model exists (docs/REPO.md). Names here are illustrative only.
 */
const PLACEHOLDER_BARANGAYS = ["Poblacion I", "Poblacion II", "Poblacion III", "Valencia", "Guadalupe"];

export function BarangaySelect(props: {
  language: LanguageCode;
  onBack: () => void;
  onLanguageClick: () => void;
  onNext: (barangayCode: string) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState(false);

  const visible = PLACEHOLDER_BARANGAYS.filter((name) => name.toLowerCase().includes(query.toLowerCase()));

  return (
    <section className="screen">
      <ScreenHeader onBack={props.onBack} language={props.language} onLanguageClick={props.onLanguageClick} />
      <ProgressBar step={3} total={3} label={props.t("stepOf", { current: 3, total: 3 })} />
      <p className="field-label">{props.t("barangayPrompt")}</p>
      <div className="barangay-search">
        <input
          type="text"
          className="text-input"
          placeholder={props.t("barangaySearchPlaceholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="barangay-list">
        {visible.map((name) => (
          <button
            key={name}
            type="button"
            className={name === selected ? "option-card option-card-selected" : "option-card"}
            onClick={() => setSelected(name)}
          >
            <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <strong>{name}</strong>
              {name === selected ? <Icon name="check" size={16} /> : null}
            </span>
          </button>
        ))}
      </div>
      <span className="spacer" />
      <button type="button" className="text-link-button" onClick={() => setShowWhy((v) => !v)}>
        {props.t("whyDoWeAsk")}
      </button>
      {showWhy ? <p className="disclaimer-card">{props.t("whyDoWeAskBody")}</p> : null}
      <button
        type="button"
        className="primary-button"
        disabled={!selected}
        onClick={() => selected && props.onNext(selected)}
      >
        {props.t("next")}
      </button>
    </section>
  );
}
