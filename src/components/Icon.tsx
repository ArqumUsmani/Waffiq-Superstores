/**
 * The header/drawer icon set, transcribed from the vanilla shell's ICONS
 * table. Same viewBox, same stroke settings, same path data — the CSS that
 * sizes and crossfades them keys off `.ico` and the modifier classes, so
 * those have to stay exactly as they were.
 */
import type { ReactNode } from 'react';

export type IconName =
  | 'search'
  | 'sun'
  | 'moon'
  | 'menu'
  | 'close'
  | 'up'
  | 'soundOn'
  | 'soundOff';

const PATHS: Record<IconName, ReactNode> = {
  search: <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  up: <path d="M12 19V5M6 11l6-6 6 6" />,
  soundOn: (
    <>
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      <path d="M16 8.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12" />
    </>
  ),
  soundOff: (
    <>
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      <path d="M17 9l6 6M23 9l-6 6" />
    </>
  ),
};

export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return (
    <svg
      className={`ico ${className}`.trim()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
