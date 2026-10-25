import type { CSSProperties } from "react";

const paths = {
  overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  signal: "M4 17v3 M9 12v8 M14 7v13 M19 3v17",
  spark: "m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6L12 3Z",
  box: "m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4 M12 11v10 M7 5l10 4",
  book: "M12 5v16 M12 5C9 3 6 3 3 4v15c3-1 6-1 9 2 3-3 6-3 9-2V4c-3-1-6-1-9 1Z",
  globe:
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M3 12h18 M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z",
  report: "M5 3h10l4 4v14H5V3Z M14 3v5h5 M8 12h8 M8 16h5",
  link: "m10 14 4-4 M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0 M16 8l1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0",
  arrow: "M4 12h16 m-6-6 6 6-6 6",
  chevron: "m8 10 4 4 4-4",
  search: "M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z m-1 5 6 6",
  plus: "M12 5v14 M5 12h14",
  close: "m6 6 12 12 M6 18 18 6",
  check: "m5 12 4 4L19 6",
  download: "M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  help: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5 M12 17h.01",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M12 7v5l3 2",
  external: "M14 3h7v7 M21 3 10 14 M10 3H3v18h18v-7",
} as const;
export type IconName = keyof typeof paths;
export function Icon({
  name,
  size = 18,
  style,
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  );
}
export function BrandMark() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 24V4h22M8 24V9h17M13 24V14h12"
        stroke="currentColor"
        strokeWidth="2.4"
      />
    </svg>
  );
}
