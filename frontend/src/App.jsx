import { useState } from 'react';
import ImageUploader  from './components/ImageUploader';
import PatternGrid    from './components/PatternGrid';
import ColorLegend    from './components/ColorLegend';
import LoadingSpinner from './components/LoadingSpinner';
import { T }          from './design/tokens';
import { Wordmark, Button, Pill } from './design/primitives';
import { Ico }        from './design/icons';

export default function App() {
  const [pattern,     setPattern]     = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [gridSize,    setGridSize]    = useState(50);
  const [numColors,   setNumColors]   = useState(15);
  const [previewUrl,  setPreviewUrl]  = useState(null);
  const [highlighted, setHighlighted] = useState(null);
  const [file,        setFile]        = useState(null);

  const handleGenerate = async (selectedFile) => {
    const f = selectedFile || file;
    if (!f) return;
    setLoading(true);
    setError(null);
    setPattern(null);
    setHighlighted(null);

    const fd = new FormData();
    fd.append('image',     f);
    fd.append('gridSize',  String(gridSize));
    fd.append('numColors', String(numColors));

    try {
      const resp = await fetch('/api/pattern', { method: 'POST', body: fd });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${resp.status}`);
      }
      const data = await resp.json();
      setPattern(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPattern(null);
    setError(null);
    setHighlighted(null);
  };

  return (
    <div style={{
      minHeight: '100vh', background: T.cream, fontFamily: T.sans, color: T.ink,
    }}>
      {/* Header */}
      <header style={{
        height: 68, padding: '0 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(251,247,242,.85)', backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${T.line}`, position: 'sticky', top: 0, zIndex: 10,
      }}>
        <Wordmark size={22} tag={true}/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 13, color: T.inkSoft }}>
            AI cross-stitch studio
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1440, margin: '0 auto' }}>
        {/* Loading state */}
        {loading && <LoadingSpinner />}

        {/* Error state */}
        {error && !loading && (
          <div style={{ padding: '60px 80px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'start' }}>
            <div style={{
              background: T.errorBg, border: '1px solid #ECC6C7',
              borderRadius: 32, padding: '44px 42px',
              boxShadow: '0 2px 6px rgba(155,93,93,.08), 0 20px 44px rgba(155,93,93,.08)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 14, background: '#F0B9BA',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.errorTx,
                }}>
                  <Ico.info s={22}/>
                </div>
                <div style={{ fontSize: 12, color: T.errorTx, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase' }}>
                  Something frayed
                </div>
              </div>
              <div style={{ marginTop: 22, fontSize: 32, fontWeight: 700, letterSpacing: -0.7, lineHeight: 1.15, color: T.ink }}>
                Your photo didn't quite fit on the loom.
              </div>
              <div style={{ marginTop: 14, fontSize: 15, color: T.inkSoft, lineHeight: 1.6, maxWidth: 420 }}>
                {error}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 26 }}>
                <Button kind="primary" icon={<Ico.refresh s={16}/>} onClick={() => handleGenerate()} style={{ padding: '14px 22px' }}>Try again</Button>
                <Button kind="soft" icon={<Ico.gallery s={16}/>} onClick={handleReset} style={{ padding: '14px 22px' }}>Pick another photo</Button>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: T.inkMute, letterSpacing: 1.8, textTransform: 'uppercase', fontWeight: 600 }}>Stitch-friendly photos</div>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.4, marginTop: 4 }}>What works best</div>
              <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { t: 'Soft portraits', d: 'Close-up faces with even lighting.', tint: T.rose },
                  { t: 'Still life',     d: 'Flowers, fruit, pets — clear subject.', tint: T.mint },
                  { t: 'High contrast',  d: 'Obvious separation between areas.',  tint: T.powder },
                  { t: 'Square framing', d: 'Closer to 1:1 crops better onto grid.', tint: T.butter },
                ].map((tip, i) => (
                  <div key={i} style={{
                    padding: '18px 18px', background: T.paper,
                    border: `1px solid ${T.line}`, borderRadius: 20,
                  }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: tip.tint, marginBottom: 10 }}/>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{tip.t}</div>
                    <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4, lineHeight: 1.5 }}>{tip.d}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Pattern result */}
        {pattern && !loading && !error && (
          <div style={{ padding: '22px 48px 40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 12, color: T.inkMute, letterSpacing: 1.8, textTransform: 'uppercase', fontWeight: 600 }}>Pattern · ready to print</div>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5, marginTop: 2 }}>Your cross-stitch chart</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <Pill tint={T.lavender}>{pattern.width} × {pattern.height} cells</Pill>
                  <Pill tint={T.mint}>{(pattern.width * pattern.height).toLocaleString()} stitches</Pill>
                  <Pill tint={T.butter}>{pattern.colors.length} colours</Pill>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Button kind="soft" icon={<Ico.refresh s={16}/>} onClick={handleReset} style={{ padding: '12px 18px' }}>New pattern</Button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }}>
              <PatternGrid
                grid={pattern.grid}
                colors={pattern.colors}
                width={pattern.width}
                height={pattern.height}
                highlighted={highlighted}
              />
              <ColorLegend
                colors={pattern.colors}
                highlighted={highlighted}
                onHighlight={(id) => setHighlighted(id === highlighted ? null : id)}
              />
            </div>
          </div>
        )}

        {/* Home / Upload */}
        {!pattern && !loading && !error && (
          <ImageUploader
            onGenerate={handleGenerate}
            file={file}
            setFile={setFile}
            previewUrl={previewUrl}
            setPreviewUrl={setPreviewUrl}
            gridSize={gridSize}
            setGridSize={setGridSize}
            numColors={numColors}
            setNumColors={setNumColors}
          />
        )}
      </main>
    </div>
  );
}
