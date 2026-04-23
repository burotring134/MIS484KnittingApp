import { T } from './tokens';

// Pastel pill badge
export function Pill({ children, tint = T.rose, fg, style = {} }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 12px', borderRadius: 999,
      background: tint, color: fg || T.ink,
      fontSize: 13, fontWeight: 500, letterSpacing: -0.1,
      ...style,
    }}>{children}</span>
  );
}

// Primary action button — dusty mauve, soft shadow
export function Button({ kind = 'primary', children, icon, style = {}, full, disabled, onClick, type = 'button' }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontFamily: T.sans, fontWeight: 600, fontSize: 15, letterSpacing: -0.1,
    borderRadius: 999, padding: '14px 22px', border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'transform .15s, box-shadow .2s, opacity .2s',
    width: full ? '100%' : undefined,
    opacity: disabled ? 0.5 : 1,
  };
  const kinds = {
    primary: { background: T.mauve, color: '#fff', boxShadow: '0 2px 4px rgba(176,118,129,.2), 0 10px 22px rgba(176,118,129,.18)' },
    soft:    { background: T.paper, color: T.ink, boxShadow: T.shadowSm, border: `1px solid ${T.line}` },
    ghost:   { background: 'transparent', color: T.inkSoft },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ ...base, ...kinds[kind], ...style }}>
      {icon}{children}
    </button>
  );
}

// Circular progress ring with pastel gradient stroke
export function ProgressRing({ size = 160, progress = 0.62, stroke = 10 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - progress);
  const gid = `grad-${Math.round(progress * 1000)}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#D9A7B0"/>
          <stop offset="45%"  stopColor="#C9A9D8"/>
          <stop offset="100%" stopColor="#A8CBBE"/>
        </linearGradient>
      </defs>
      <circle cx={size/2} cy={size/2} r={r} stroke={T.lineSoft} strokeWidth={stroke} fill="none"/>
      <circle cx={size/2} cy={size/2} r={r}
        stroke={`url(#${gid})`} strokeWidth={stroke} strokeLinecap="round" fill="none"
        strokeDasharray={c} strokeDashoffset={off}
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}/>
    </svg>
  );
}

// Hero illustration: pastel line-art needle + thread loop
export function NeedleIllustration({ w = 260, h = 160 }) {
  return (
    <svg width={w} height={h} viewBox="0 0 260 160" fill="none">
      <circle cx="60"  cy="70" r="42" fill="#FADADD" opacity="0.55"/>
      <circle cx="200" cy="90" r="34" fill="#D4F1E8" opacity="0.7"/>
      <circle cx="130" cy="40" r="26" fill="#FDF4D2" opacity="0.8"/>
      <path d="M40 120 C 80 60, 140 40, 190 70 S 250 140, 210 140 S 150 100, 120 120 S 70 150, 40 120 Z"
        stroke="#D9A7B0" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeDasharray="1 4"/>
      <g transform="rotate(-28 150 80)">
        <line x1="80" y1="80" x2="220" y2="80" stroke="#6B5D56" strokeWidth="2" strokeLinecap="round"/>
        <ellipse cx="82" cy="80" rx="8" ry="4" stroke="#6B5D56" strokeWidth="2" fill="#FFFFFF"/>
        <line x1="84" y1="80" x2="88" y2="80" stroke="#6B5D56" strokeWidth="1.2"/>
        <path d="M220 78 L228 80 L220 82 Z" fill="#6B5D56"/>
      </g>
      {[[30,50],[220,40],[235,120],[50,135]].map(([x,y], i) => (
        <g key={i} stroke="#B07681" strokeWidth="1.5" strokeLinecap="round">
          <path d={`M${x-4} ${y-4} L${x+4} ${y+4}`}/>
          <path d={`M${x-4} ${y+4} L${x+4} ${y-4}`}/>
        </g>
      ))}
    </svg>
  );
}

// Wordmark logo: "threadia" with a subtle cross-stitch X
export function Wordmark({ size = 28, color, tag = true }) {
  const c = color || T.ink;
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontFamily: T.sans }}>
      <span style={{
        fontSize: size, fontWeight: 700, letterSpacing: -0.8, color: c,
        display: 'inline-flex', alignItems: 'center',
      }}>
        threadia
        <span style={{ marginLeft: 2, display: 'inline-block', transform: 'translateY(-0.18em)' }}>
          <svg width={size*0.34} height={size*0.34} viewBox="0 0 10 10">
            <path d="M2 2 L8 8 M8 2 L2 8" stroke={T.mauve} strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </span>
      </span>
      {tag && (
        <span style={{ fontSize: 13, color: T.inkMute, letterSpacing: 0.2 }}>
          cross-stitch, made gentle
        </span>
      )}
    </div>
  );
}
