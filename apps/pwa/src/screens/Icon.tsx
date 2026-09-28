/*
 * Line icons for the patient app, replacing the emoji and text glyphs the
 * screens used before. Emoji render differently on every Android build (and
 * as empty boxes on some older ones); a stroked path looks the same on every
 * phone and takes the colour of the text around it.
 *
 * Most paths are ported from kizaru3214's `feat/pwa-ui-polish`
 * (apps/pwa/src/components/Icon.tsx). Added here: alert, x, plus and circle.
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
  | "x";

const PATHS: Record<IconName, string> = {
  alert: "M12 4 2.8 19.5a1 1 0 0 0 .86 1.5h16.68a1 1 0 0 0 .86-1.5zM12 10v4.5M12 17.5v.01",
  check: "M4 12l5 5 11-11",
  chevronLeft: "M15 5 8 12l7 7",
  circle: "M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14z",
  clinic: "M8 3h8v4h4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7h4zM12 9v6M9 12h6",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4.5 12a7.5 7.5 0 0 1 .3-2.1L3 8.4l1.5-2.6 2.1.7a7.6 7.6 0 0 1 1.8-1.05L8.8 3h3.4l.4 2.45c.66.25 1.27.6 1.8 1.05l2.1-.7L18 8.4l-1.8 1.5c.2.68.3 1.38.3 2.1s-.1 1.42-.3 2.1L18 15.6l-1.5 2.6-2.1-.7a7.6 7.6 0 0 1-1.8 1.05L12.2 21H8.8l-.4-2.45a7.6 7.6 0 0 1-1.8-1.05l-2.1.7L3 15.6l1.8-1.5c-.2-.68-.3-1.38-.3-2.1z",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3.5 9h17M3.5 15h17M12 3c2.2 2.4 3.4 5.6 3.4 9s-1.2 6.6-3.4 9c-2.2-2.4-3.4-5.6-3.4-9s1.2-6.6 3.4-9z",
  home: "M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.01",
  mapPin: "M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  mic: "M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4",
  phone: "M6.5 3h3l1.5 5-2.5 1.5a12 12 0 0 0 5 5L15 12l5 1.5v3a2 2 0 0 1-2 2C10.5 18.5 5.5 13.5 4.5 6a2 2 0 0 1 2-2z",
  plus: "M12 5v14M5 12h14",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.35-4.35",
  x: "M6 6l12 12M18 6 6 18",
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
