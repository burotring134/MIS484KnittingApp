// Threadia line icons — 1.6 stroke, rounded caps, currentColor

export const Ico = {
  plus: (p = {}) => (
    <svg width={p.s||20} height={p.s||20} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M10 4v12M4 10h12"/>
    </svg>
  ),
  minus: (p = {}) => (
    <svg width={p.s||18} height={p.s||18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M4 9h10"/>
    </svg>
  ),
  camera: (p = {}) => (
    <svg width={p.s||20} height={p.s||20} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
      <path d="M3 7.5a2 2 0 0 1 2-2h1.3l1.2-1.5h4l1.2 1.5H15a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7Z"/>
      <circle cx="10" cy="11" r="3"/>
    </svg>
  ),
  gallery: (p = {}) => (
    <svg width={p.s||20} height={p.s||20} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <rect x="3" y="3" width="14" height="14" rx="2.5"/>
      <circle cx="7.5" cy="7.5" r="1.4"/>
      <path d="M3.5 15l4-4 3 3 2-2 4 4"/>
    </svg>
  ),
  upload: (p = {}) => (
    <svg width={p.s||20} height={p.s||20} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13V4M6.5 7.5L10 4l3.5 3.5"/>
      <path d="M4 13v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2"/>
    </svg>
  ),
  sparkle: (p = {}) => (
    <svg width={p.s||18} height={p.s||18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M9 2v3M9 13v3M2 9h3M13 9h3M4 4l2 2M12 12l2 2M14 4l-2 2M6 12l-2 2"/>
    </svg>
  ),
  download: (p = {}) => (
    <svg width={p.s||18} height={p.s||18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3v9M5.5 8.5L9 12l3.5-3.5"/>
      <path d="M3 13v1.5A1.5 1.5 0 0 0 4.5 16h9a1.5 1.5 0 0 0 1.5-1.5V13"/>
    </svg>
  ),
  search: (p = {}) => (
    <svg width={p.s||16} height={p.s||16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="7" cy="7" r="4.5"/>
      <path d="M10.5 10.5L14 14"/>
    </svg>
  ),
  check: (p = {}) => (
    <svg width={p.s||16} height={p.s||16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 8.5L7 12l6-7"/>
    </svg>
  ),
  info: (p = {}) => (
    <svg width={p.s||16} height={p.s||16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="8" r="5.5"/>
      <path d="M8 7.5v3M8 5.2v.1"/>
    </svg>
  ),
  refresh: (p = {}) => (
    <svg width={p.s||18} height={p.s||18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9a6 6 0 0 1 10.5-4M15 9a6 6 0 0 1-10.5 4"/>
      <path d="M13.5 2v3h-3M4.5 16v-3h3"/>
    </svg>
  ),
};
