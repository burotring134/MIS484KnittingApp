import { useState, useEffect } from 'react';
import { T } from '../design/tokens';
import { ProgressRing } from '../design/primitives';
import { Ico } from '../design/icons';

const STEPS = [
  { t: 'Upload received',   d: 'Photo arrived safely.' },
  { t: 'AI styling',        d: 'Softening edges for clean stitches.' },
  { t: 'Resize to grid',    d: 'Fitting to pattern dimensions.' },
  { t: 'Quantise colors',   d: 'Finding dominant tones.' },
  { t: 'Map to DMC',        d: 'Matching to real thread codes.' },
  { t: 'Build chart',       d: 'Assembling legend & symbols.' },
];

export default function LoadingSpinner() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStep((s) => (s + 1 < STEPS.length ? s + 1 : s));
    }, 3500);
    return () => clearInterval(id);
  }, []);

  const progress = Math.min(0.95, (step + 0.5) / STEPS.length);
  const pct = Math.round(progress * 100);

  return (
    <div style={{ padding: '56px 80px 40px', display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 48 }}>
      {/* ring card */}
      <div style={{
        background: T.paper, borderRadius: 32, padding: 40,
        border: `1px solid ${T.line}`, boxShadow: T.shadowMd,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{ position: 'relative', width: 280, height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ProgressRing size={280} progress={progress} stroke={14}/>
          <div style={{ position: 'absolute', textAlign: 'center' }}>
            <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: -2, color: T.ink, lineHeight: 1 }}>
              {pct}<span style={{ fontSize: 28, color: T.inkSoft }}>%</span>
            </div>
            <div style={{ fontSize: 11, color: T.inkMute, letterSpacing: 1.6, textTransform: 'uppercase', marginTop: 6, fontWeight: 600 }}>
              weaving
            </div>
          </div>
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5, marginTop: 22 }}>
          Weaving your pattern…
        </div>
        <div style={{ fontSize: 14, color: T.inkSoft, marginTop: 8, textAlign: 'center', maxWidth: 320, lineHeight: 1.55 }}>
          We're choosing the gentlest thread colors that match your photo. This usually takes under a minute.
        </div>
        <div style={{
          marginTop: 26, padding: '10px 16px', background: T.creamDeep,
          borderRadius: 999, fontSize: 12, color: T.inkSoft, display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: 99, background: T.mauve,
            animation: 'pulse 1.6s infinite',
          }}/>
          Current step · {STEPS[step].t}
        </div>
      </div>

      {/* step list */}
      <div style={{
        background: T.paper, borderRadius: 32, padding: 12,
        border: `1px solid ${T.line}`, boxShadow: T.shadowSm,
      }}>
        <div style={{ padding: '18px 24px 8px' }}>
          <div style={{ fontSize: 12, color: T.inkMute, letterSpacing: 1.8, textTransform: 'uppercase', fontWeight: 600 }}>
            Live progress
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
            {STEPS.length} steps
          </div>
        </div>
        {STEPS.map((s, i) => {
          const last = i === STEPS.length - 1;
          const done = i < step;
          const active = i === step;
          const dot = done ? T.mint : active ? T.rose : T.lineSoft;
          const ink = active ? T.ink : done ? T.inkSoft : T.inkMute;
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', padding: '14px 18px',
              margin: '0 6px', borderRadius: 14,
              background: active ? T.creamDeep : 'transparent',
              borderBottom: last ? 'none' : `1px solid ${T.lineSoft}`,
              transition: 'background .3s',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 999, background: dot,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.mauveDeep,
                flexShrink: 0, marginRight: 14,
              }}>
                {done ? <Ico.check s={14}/> : active ? (
                  <div style={{
                    width: 10, height: 10, borderRadius: 99, background: T.mauveDeep,
                    boxShadow: '0 0 0 4px rgba(217,167,176,.4)',
                  }}/>
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.inkMute }}>{i+1}</span>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: active ? 700 : 600, color: ink, letterSpacing: -0.1 }}>{s.t}</div>
                <div style={{ fontSize: 12, color: T.inkMute, marginTop: 2 }}>{s.d}</div>
              </div>
              {active && (
                <div style={{ display: 'flex', gap: 3 }}>
                  {[0,1,2].map(k => (
                    <div key={k} style={{ width: 5, height: 5, borderRadius: 99, background: T.mauve, opacity: 1 - k*0.3 }}/>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
