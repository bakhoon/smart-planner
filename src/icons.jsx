// Inline stroke icons (no network needed)
const base = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const Plus = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth="2.4" {...base}><path d="M12 5v14M5 12h14" /></svg>
);
export const ChevronLeft = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth="2.4" {...base}><path d="M15 6l-6 6 6 6" /></svg>
);
export const ChevronRight = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth="2.4" {...base}><path d="M9 6l6 6-6 6" /></svg>
);
export const Close = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth="2.4" {...base}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const Clock = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth="2.2" {...base}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
);
export const Flag = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth="2.2" {...base}><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>
);
export const Repeat = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth="2.4" {...base}><path d="M17 2l4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /></svg>
);
export const Trash = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth="2.2" {...base}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
);
export const Sliders = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth="2.2" {...base}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
);
export const Board = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth="2.4" {...base}><rect x="4" y="4" width="6" height="16" rx="1.5" /><rect x="14" y="4" width="6" height="10" rx="1.5" /></svg>
);
export const Download = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth="2.2" {...base}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
);
export const Upload = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth="2.2" {...base}><path d="M12 20V9M7 14l5-5 5 5M5 4h14" /></svg>
);
export const ArrowUp = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth="2.6" {...base}><path d="M6 15l6-6 6 6" /></svg>
);
