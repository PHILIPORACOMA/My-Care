export type IconName =
  | "home"
  | "clinic"
  | "heartbeat"
  | "mic"
  | "gear"
  | "chevronLeft"
  | "chevronRight"
  | "globe"
  | "search"
  | "check"
  | "phone"
  | "refresh"
  | "info"
  | "mapPin"
  | "droplet"
  | "thermometer"
  | "pillOff"
  | "calendarClock"
  | "upload"
  | "tag"
  |  "user";

const PATHS: Record<IconName, string> = {
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0",
  home: "M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z",
  clinic: "M8 3h8v4h4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7h4zM12 9v6M9 12h6",
  heartbeat: "M3 12h4l2-6 4 12 2-6h6",
  mic: "M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4.5 12a7.5 7.5 0 0 1 .3-2.1L3 8.4l1.5-2.6 2.1.7a7.6 7.6 0 0 1 1.8-1.05L8.8 3h3.4l.4 2.45c.66.25 1.27.6 1.8 1.05l2.1-.7L18 8.4l-1.8 1.5c.2.68.3 1.38.3 2.1s-.1 1.42-.3 2.1L18 15.6l-1.5 2.6-2.1-.7a7.6 7.6 0 0 1-1.8 1.05L12.2 21H8.8l-.4-2.45a7.6 7.6 0 0 1-1.8-1.05l-2.1.7L3 15.6l1.8-1.5c-.2-.68-.3-1.38-.3-2.1z",
  chevronLeft: "M15 5 8 12l7 7",
  chevronRight: "M9 5l7 7-7 7",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3.5 9h17M3.5 15h17M12 3c2.2 2.4 3.4 5.6 3.4 9s-1.2 6.6-3.4 9c-2.2-2.4-3.4-5.6-3.4-9s1.2-6.6 3.4-9z",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.35-4.35",
  check: "M4 12l5 5 11-11",
  phone: "M6.5 3h3l1.5 5-2.5 1.5a12 12 0 0 0 5 5L15 12l5 1.5v3a2 2 0 0 1-2 2C10.5 18.5 5.5 13.5 4.5 6a2 2 0 0 1 2-2z",
  refresh: "M20 11A8 8 0 0 0 6.3 6.3L4 8.6M4 4v4.6h4.6M4 13a8 8 0 0 0 13.7 4.7L20 15.4M20 20v-4.6h-4.6",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.01",
  mapPin: "M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  droplet: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z",
  thermometer: "M12 3a2 2 0 0 0-2 2v9.5a4 4 0 1 0 4 0V5a2 2 0 0 0-2-2zM12 14v-6",
  pillOff: "M4.5 4.5 19.5 19.5M9 15l6-6a4.24 4.24 0 0 0-6-6L5.3 6.7a4.24 4.24 0 0 0 0 6zM9 15l6 6a4.24 4.24 0 0 0 6-6l-2-2",
  calendarClock: "M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 9.5h16M8 3v3M16 3v3M15 14.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM15 16v1.5l1 .75",
  upload: "M12 16V4M8 8l4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3",
  tag: "M20 12.5V6a1 1 0 0 0-1-1h-6.5a1 1 0 0 0-.7.29l-8 8a1 1 0 0 0 0 1.42l6.5 6.5a1 1 0 0 0 1.42 0l8-8a1 1 0 0 0 .28-.71zM15.5 8.01h.01",
};

export function Icon(props: { name: IconName; size?: number }) {
  const size = props.size ?? 22;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[props.name]} />
    </svg>
  );
}
