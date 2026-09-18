import type { LanguageCode } from "@mycare/ruleset";

const LANGUAGES: { code: LanguageCode; labelKey: string }[] = [
  { code: "ceb", labelKey: "languageCeb" },
  { code: "tl", labelKey: "languageTl" },
  { code: "en", labelKey: "languageEn" },
];

export function LanguageToggle(props: {
  selected: LanguageCode;
  onSelect: (language: LanguageCode) => void;
  labels: Record<string, string>;
}) {
  return (
    <div className="language-toggle" role="group">
      {LANGUAGES.map(({ code, labelKey }) => (
        <button
          key={code}
          type="button"
          className={code === props.selected ? "chip chip-selected" : "chip"}
          onClick={() => props.onSelect(code)}
        >
          {props.labels[labelKey] ?? code}
        </button>
      ))}
    </div>
  );
}
