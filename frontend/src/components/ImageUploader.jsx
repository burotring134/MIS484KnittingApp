import { useState, useRef } from 'react';
import { T } from '../design/tokens';
import { Button, Pill, NeedleIllustration } from '../design/primitives';
import { Ico } from '../design/icons';

const DIFFICULTIES = [
  { id: 'easy',   label: 'Kolay',  desc: '30 cells · 8 colours · heavy posterise', gridSize: 30, numColors: 8  },
  { id: 'medium', label: 'Orta',   desc: '50 cells · 15 colours · balanced',       gridSize: 50, numColors: 15 },
  { id: 'hard',   label: 'Zor',    desc: '80 cells · 25 colours · detailed',       gridSize: 80, numColors: 25 },
];

export default function ImageUploader({
  onGenerate, file, setFile, previewUrl, setPreviewUrl,
  gridSize, setGridSize, numColors, setNumColors,
  difficulty, setDifficulty,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const applyDifficulty = (id) => {
    const preset = DIFFICULTIES.find((d) => d.id === id);
    if (!preset) return;
    setDifficulty(id);
    setGridSize(preset.gridSize);
    setNumColors(preset.numColors);
  };

  const applyFile = (f) => {
    if (!f || !f.type.startsWith('image/')) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    applyFile(e.dataTransfer.files[0]);
  };

  const widths = [30, 50, 80, 100];

  return (
    <div style={{ padding: '36px 80px 60px' }}>
      {/* Top row: hero + drop zone */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 40, alignItems: 'start' }}>
        {/* Hero card */}
        <div style={{
          background: `linear-gradient(150deg, ${T.rose} 0%, ${T.peach} 48%, ${T.butter} 100%)`,
          borderRadius: 32, padding: '48px 48px 44px', position: 'relative', overflow: 'hidden',
          boxShadow: T.shadowLg, minHeight: 500,
        }}>
          <div style={{ position: 'absolute', right: -20, top: 20, opacity: 0.9 }}>
            <NeedleIllustration w={340} h={240}/>
          </div>
          <div style={{ fontSize: 12, letterSpacing: 2.4, textTransform: 'uppercase', color: T.mauveDeep, fontWeight: 700 }}>
            AI pattern studio
          </div>
          <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1, letterSpacing: -1.6, marginTop: 22, maxWidth: 540 }}>
            Turn memories<br/>into stitches.
          </div>
          <div style={{ fontSize: 17, color: T.inkSoft, marginTop: 20, maxWidth: 440, lineHeight: 1.55 }}>
            Upload a photo. Threadia weaves it into a printable cross-stitch chart, mapped to real DMC thread colors.
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 36, position: 'relative', zIndex: 1 }}>
            <Button kind="primary" icon={<Ico.gallery s={18}/>} style={{ padding: '15px 26px' }}
              onClick={() => inputRef.current?.click()}>
              Choose from gallery
            </Button>
          </div>
          <div style={{ marginTop: 42, display: 'flex', gap: 22, alignItems: 'center', color: T.inkSoft, fontSize: 13 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: T.successTx }}/>
              Real DMC thread codes
            </span>
            <span>·</span>
            <span>500+ shades</span>
          </div>
        </div>

        {/* Drop zone or preview */}
        <div style={{
          background: T.paper, borderRadius: 32, padding: 22,
          border: `1px solid ${T.line}`, boxShadow: T.shadowSm, minHeight: 500,
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px 18px' }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{previewUrl ? 'Your photo' : 'Drop a photo'}</div>
            <Pill tint={T.mint} style={{ color: T.successTx, fontWeight: 600 }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: T.successTx }}/>
              {previewUrl ? 'Ready to weave' : 'Awaiting photo'}
            </Pill>
          </div>

          {previewUrl ? (
            <div style={{ position: 'relative', borderRadius: 22, overflow: 'hidden', flex: 1 }}>
              <img src={previewUrl} alt="Preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', minHeight: 380 }}/>
              <div style={{
                position: 'absolute', left: 14, bottom: 14, display: 'flex', gap: 8,
              }}>
                <Pill tint="rgba(255,255,255,.85)" style={{ backdropFilter: 'blur(8px)' }}>
                  {file?.name?.slice(0, 24) || 'photo'}
                </Pill>
                <Pill tint="rgba(255,255,255,.85)" style={{ backdropFilter: 'blur(8px)' }}>
                  {file ? `${(file.size/1024).toFixed(0)} KB` : ''}
                </Pill>
              </div>
              <div style={{
                position: 'absolute', top: 14, right: 14,
              }}>
                <Button kind="soft" icon={<Ico.refresh s={14}/>} onClick={() => inputRef.current?.click()}
                  style={{ padding: '8px 14px', fontSize: 12 }}>
                  Change
                </Button>
              </div>
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              style={{
                flex: 1, borderRadius: 22, position: 'relative', cursor: 'pointer',
                background: isDragging
                  ? T.rose
                  : `repeating-linear-gradient(135deg, ${T.creamDeep} 0 14px, ${T.paper} 14px 15px)`,
                border: `2px dashed ${T.mauve}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: 32, textAlign: 'center',
                transition: 'background .2s',
              }}>
              <div style={{
                width: 72, height: 72, borderRadius: 22, background: T.rose,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: T.mauveDeep, marginBottom: 18,
              }}>
                <Ico.upload s={30}/>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4 }}>Drag a photo here</div>
              <div style={{ fontSize: 14, color: T.inkSoft, marginTop: 8, maxWidth: 300, lineHeight: 1.5 }}>
                or <span style={{ color: T.mauveDeep, fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3 }}>browse your files</span>. JPG or PNG, up to 10 MB.
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 26 }}>
                {[T.rose, T.lavender, T.mint, T.butter, T.powder, T.peach].map((c, i) => (
                  <div key={i} style={{ width: 24, height: 24, borderRadius: 8, background: c, border: `1px solid ${T.line}` }}/>
                ))}
              </div>
              <div style={{ fontSize: 11, color: T.inkMute, marginTop: 10, letterSpacing: 0.5 }}>
                PASTEL PALETTE · 500+ DMC MATCHES
              </div>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => applyFile(e.target.files[0])}
          />
        </div>
      </div>

      {/* Settings + How it works */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 40, marginTop: 40 }}>
        {/* Settings panel */}
        <div style={{
          background: T.paper, borderRadius: 28, padding: 28,
          border: `1px solid ${T.line}`, boxShadow: T.shadowSm,
        }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4 }}>Pattern settings</div>
          <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 4 }}>
            Pick a difficulty preset or fine-tune below.
          </div>

          {/* Difficulty presets */}
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Difficulty</div>
              <div style={{ fontSize: 12, color: T.inkMute }}>presets fill grid + colours</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {DIFFICULTIES.map((d) => {
                const on = d.id === difficulty;
                return (
                  <button key={d.id} onClick={() => applyDifficulty(d.id)} style={{
                    textAlign: 'left', padding: '14px 14px', borderRadius: 16,
                    background: on ? T.mauve : T.creamDeep,
                    color: on ? '#fff' : T.ink,
                    border: on ? 'none' : `1px solid ${T.line}`,
                    cursor: 'pointer', fontFamily: T.sans,
                    boxShadow: on ? '0 4px 14px rgba(176,118,129,.25)' : 'none',
                  }}>
                    <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.2 }}>{d.label}</div>
                    <div style={{ fontSize: 10, fontWeight: 500, marginTop: 4, opacity: on ? 0.85 : 0.6, lineHeight: 1.3 }}>
                      {d.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Grid width</div>
              <div style={{ fontSize: 12, color: T.inkMute }}>cells across</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
              {widths.map(w => {
                const on = w === gridSize;
                return (
                  <button key={w} onClick={() => setGridSize(w)} style={{
                    textAlign: 'center', padding: '16px 0', borderRadius: 16,
                    background: on ? T.mauve : T.creamDeep,
                    color: on ? '#fff' : T.ink,
                    border: on ? 'none' : `1px solid ${T.line}`,
                    fontWeight: 700, fontSize: 18, letterSpacing: -0.3, cursor: 'pointer',
                    boxShadow: on ? '0 4px 14px rgba(176,118,129,.25)' : 'none',
                    fontFamily: T.sans,
                  }}>
                    {w}
                    <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: 0.6, marginTop: 2, opacity: on ? 0.85 : 0.55, textTransform: 'uppercase' }}>cells</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Thread colors</div>
              <div style={{
                padding: '4px 12px', borderRadius: 999, background: T.lavender,
                fontSize: 13, fontWeight: 700, color: T.mauveDeep,
              }}>{numColors}</div>
            </div>
            <div style={{ position: 'relative', height: 40, display: 'flex', alignItems: 'center' }}>
              <input type="range" min="5" max="30" value={numColors}
                onChange={(e) => setNumColors(Number(e.target.value))}
                style={{
                  position: 'absolute', inset: 0, width: '100%', opacity: 0,
                  cursor: 'pointer', zIndex: 2,
                }}/>
              <div style={{ position: 'absolute', left: 0, right: 0, height: 6, borderRadius: 3, background: T.creamDeep }}/>
              <div style={{
                position: 'absolute', left: 0, width: `${((numColors-5)/25)*100}%`, height: 6, borderRadius: 3,
                background: `linear-gradient(90deg, ${T.mauve}, ${T.lavender})`,
              }}/>
              <div style={{
                position: 'absolute', left: `calc(${((numColors-5)/25)*100}% - 16px)`,
                width: 32, height: 32, borderRadius: 999, background: '#fff',
                boxShadow: '0 2px 8px rgba(61,52,48,.18), 0 0 0 1px rgba(61,52,48,.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: T.mauveDeep,
                pointerEvents: 'none',
              }}>{numColors}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.inkMute, marginTop: 10, letterSpacing: 0.5 }}>
              <span>SIMPLE · 5</span>
              <span>DETAILED · 30</span>
            </div>
          </div>

          <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {[
              { t: 'Portraits', d: '50–80 cells' },
              { t: 'Scenes',    d: '80–100 cells' },
              { t: 'Icons',     d: '30 cells' },
            ].map((tip, i) => (
              <div key={i} style={{
                padding: '12px 14px', background: T.creamDeep, borderRadius: 14,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{tip.t}</div>
                <div style={{ fontSize: 11, color: T.inkMute, marginTop: 2 }}>{tip.d}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 26 }}>
            <Button kind="primary" full
              icon={<Ico.sparkle s={16}/>}
              disabled={!file}
              onClick={() => onGenerate(file)}
              style={{ padding: '16px 22px' }}>
              {file ? 'Generate pattern' : 'Choose a photo first'}
            </Button>
          </div>
        </div>

        {/* How it works */}
        <div>
          <div style={{ fontSize: 12, color: T.inkMute, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600 }}>How it works</div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.6, lineHeight: 1.05, marginTop: 6 }}>
            Three calm<br/>steps.
          </div>
          <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { n: '01', t: 'Upload',     d: 'Pick any photo or snap one. Portraits, pets, flowers — anything with soft contrast.', tint: T.powder },
              { n: '02', t: 'AI process', d: 'We resize, quantise, and map colors to real DMC thread codes with k-means clustering.', tint: T.lavender },
              { n: '03', t: 'Stitch',     d: 'Download a printable chart with symbols, gridlines, and a complete thread legend.', tint: T.mint },
            ].map((s) => (
              <div key={s.n} style={{
                background: T.paper, border: `1px solid ${T.line}`,
                borderRadius: 22, padding: '20px 22px',
                display: 'flex', gap: 14, alignItems: 'center',
              }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 14, background: s.tint,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, color: T.mauveDeep, fontSize: 13, letterSpacing: 0.5, flexShrink: 0,
                }}>{s.n}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.2 }}>{s.t}</div>
                  <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 4, lineHeight: 1.5 }}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
