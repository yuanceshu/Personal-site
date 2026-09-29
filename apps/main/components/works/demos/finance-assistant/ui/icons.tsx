import type { CSSProperties } from 'react';

export type IconName = 'overview' | 'spark' | 'reconcile' | 'alert' | 'arrow' | 'send' | 'chevron' | 'plus' | 'close' | 'check' | 'calendar' | 'company' | 'report' | 'trend' | 'menu' | 'help';
const paths: Record<IconName, string> = {
  overview: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  spark: 'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',
  reconcile: 'M4 7h15m-4-4 4 4-4 4 M20 17H5m4 4-4-4 4-4',
  alert: 'M12 3 2 21h20z M12 9v5 M12 17h.01',
  arrow: 'M5 19 19 5 M5 5h14v14',
  send: 'M12 19V5 M6 11l6-6 6 6',
  chevron: 'm8 5 7 7-7 7',
  plus: 'M12 5v14 M5 12h14',
  close: 'm6 6 12 12 M6 18 18 6',
  check: 'm5 12 4 4L19 6',
  calendar: 'M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2 M3 9h18 M8 2v4 M16 2v4',
  company: 'M4 21V7l8-4 8 4v14 M2 21h20 M8 9h.01 M16 9h.01 M8 13h.01 M16 13h.01 M10 21v-5h4v5',
  report: 'M5 3h10l4 4v14H5z M14 3v5h5 M9 12h6 M9 16h6',
  trend: 'm3 17 6-6 4 3 8-10 M15 4h6v6',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  help: 'M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3 M12 18h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
};

export default function Icon({ name, className = '', style }: { name: IconName; className?: string; style?: CSSProperties }) {
  return <svg className={`icon ${className}`} style={style} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}
