const paths = {
  chat: "M5 5h14v11H9l-4 3V5Z M8 9h8 M8 12h5",
  route: "M6 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z M18 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z M8 7h7a4 4 0 0 1 0 8H9a3 3 0 0 0 0 6h5",
  history: "M4 12a8 8 0 1 0 2-5.3 M4 5v4h4 M12 8v4l3 2",
  map: "m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z M9 4v14 M15 6v14",
  send: "m4 11 16-7-7 16-2-7-7-2Z M11 13l9-9",
  pin: "M12 21s6-5.3 6-10a6 6 0 1 0-12 0c0 4.7 6 10 6 10Z M12 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  spark: "m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z",
  clock: "M12 7v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  users: "M15 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2 M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M16 4a3 3 0 0 1 0 6 M17 14a4 4 0 0 1 4 4v2",
  play: "M8 5v14l11-7L8 5Z", stop: "M6 6h12v12H6z",
  leaf: "M5 18C0 7 13 3 21 3c0 8-4 21-15 16 M3 21l12-12 M8 16v-5 M8 16h5",
  arrow: "M4 12h16 M14 6l6 6-6 6",
  chevron: "m9 5 7 7-7 7", close: "m6 6 12 12 M6 18 18 6",
  mountain: "m2 20 7-14 4 7 3-5 6 12H2Z M6 12l3 2 3-2",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1 1 M18 18l1 1 M5 19l1-1 M18 6l1-1",
  restroom: "M7 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z M17 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z M4 13V9h6v4 M6 10v11 M8 10v11 M17 8l-3 8h6l-3-8Z M16 16v5 M18 16v5",
  bench: "M4 7h16v6H4z M3 16h18 M6 13v8 M18 13v8 M8 7v6 M16 7v6",
  cup: "M5 4h12v10a6 6 0 0 1-12 0V4Z M17 6h2a3 3 0 0 1 0 6h-2 M4 22h15",
  help: "M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z",
  gift: "M3 8h18v4H3z M5 12v9h14v-9 M12 8v13 M12 8C3 8 5 1 8 3c3 1 4 5 4 5Z M12 8c9 0 7-7 4-5-3 1-4 5-4 5Z",
  bus: "M5 4h14v14H5V4Z M5 12h14 M8 18v3 M16 18v3 M8 15h1 M15 15h1 M5 7h14",
  headphones: "M4 14v-3a8 8 0 0 1 16 0v3 M4 12h3v8H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2Z M20 12h-3v8h3a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2Z",
  check: "m5 12 4 4L19 6", plus: "M12 5v14 M5 12h14", minus: "M5 12h14",
} as const;
export type IconName = keyof typeof paths;
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}
