/*
 * Line icons for the patient app, replacing the emoji and text glyphs the
 * screens used before. Emoji render differently on every Android build (and
 * as empty boxes on some older ones); a stroked path looks the same on every
 * phone and takes the colour of the text around it.
 *
 * Most paths are ported from kizaru3214's `feat/pwa-ui-polish`
 * (apps/pwa/src/components/Icon.tsx). Added here: alert, x, plus and circle.
 * The symptom-group icons (thermometer to more) follow Lucide's 24px stroke
 * style (ISC licence); stomach, head and female are drawn for this app.
 * Inline SVG, no icon library: the whole set is a couple of kilobytes.
 */

export type IconName =
  | "alert"
  | "check"
  | "chevronLeft"
  | "circle"
  | "clinic"
  | "gear"
  | "globe"
  | "home"
  | "info"
  | "mapPin"
  | "mic"
  | "phone"
  | "plus"
  | "search"
  | "user"
  | "x"
  // Symptom groups (chip-groups.ts)
  | "thermometer"
  | "wind"
  | "heart"
  | "stomach"
  | "head"
  | "eye"
  | "bandage"
  | "bone"
  | "female"
  | "more";

const PATHS: Record<IconName, string> = {
  alert: "M12 4 2.8 19.5a1 1 0 0 0 .86 1.5h16.68a1 1 0 0 0 .86-1.5zM12 10v4.5M12 17.5v.01",
  check: "M4 12l5 5 11-11",
  chevronLeft: "M15 5 8 12l7 7",
  circle: "M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14z",
  clinic: "M8 3h8v4h4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7h4zM12 9v6M9 12h6",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3.5 9h17M3.5 15h17M12 3c2.2 2.4 3.4 5.6 3.4 9s-1.2 6.6-3.4 9c-2.2-2.4-3.4-5.6-3.4-9s1.2-6.6 3.4-9z",
  home: "M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.01",
  mapPin: "M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  mic: "M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4",
  phone: "M6.5 3h3l1.5 5-2.5 1.5a12 12 0 0 0 5 5L15 12l5 1.5v3a2 2 0 0 1-2 2C10.5 18.5 5.5 13.5 4.5 6a2 2 0 0 1 2-2z",
  plus: "M12 5v14M5 12h14",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.35-4.35",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0",
  x: "M6 6l12 12M18 6 6 18",
  thermometer: "M14 14.76V4.5a2.5 2.5 0 0 0-5 0v10.26a4 4 0 1 0 5 0zM11.5 17.5v-6",
  wind: "M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2M9.6 4.6A2 2 0 1 1 11 8H2M12.6 19.4A2 2 0 1 0 14 16H2",
  heart:
    "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z",
  stomach: "M10 3v3a3 3 0 0 0 3 3h1a5 5 0 0 1 5 5 7 7 0 0 1-7 7H9a4 4 0 0 1-4-4 3 3 0 0 1 3-3h2a2 2 0 0 0 2-2",
  head: "M12 2.5a7.5 7.5 0 0 0-7.5 7.5c0 2.3 1 4.3 2.5 5.7V21.5h8V19h2a2 2 0 0 0 2-2v-2.5l2-1-2-3.5A7.5 7.5 0 0 0 12 2.5z",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  bandage: "M4 7h16a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM8 7v10M16 7v10M11 11h.01M13 13h.01",
  bone:
    "M17 10c.7-.7 1.69 0 2.5 0a2.5 2.5 0 1 0 0-5 .5.5 0 0 1-.5-.5 2.5 2.5 0 1 0-5 0c0 .81.7 1.8 0 2.5l-7 7c-.7.7-1.69 0-2.5 0a2.5 2.5 0 0 0 0 5c.28 0 .5.22.5.5a2.5 2.5 0 1 0 5 0c0-.81-.7-1.8 0-2.5z",
  female: "M12 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 14v7M9 18h6",
  more: "M5 12h.01M12 12h.01M19 12h.01",
};

/** Decorative by default: the control around it carries the accessible name. */
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
