import { useState } from 'react';
import ImageUploader from './components/ImageUploader';
import PatternGrid   from './components/PatternGrid';
import ColorLegend   from './components/ColorLegend';
import LoadingSpinner from './components/LoadingSpinner';

export default function App() {
  const [pattern,    setPattern]    = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [gridSize,   setGridSize]   = useState(50);
  const [numColors,  setNumColors]  = useState(15);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [highlighted, setHighlighted] = useState(null);

  const handleGenerate = async (file) => {
    setLoading(true);
    setError(null);
    setPattern(null);
    setHighlighted(null);

    const fd = new FormData();
    fd.append('image',     file);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-rose-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <span className="text-3xl select-none">🧵</span>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-rose-500 to-purple-600 bg-clip-text text-transparent leading-tight">
              Threadia
            </h1>
            <p className="text-xs text-gray-400 tracking-wide">AI Cross-Stitch Pattern Generator</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Controls row ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Upload card */}
          <div className="lg:col-span-2">
            <ImageUploader
              onGenerate={handleGenerate}
              loading={loading}
              previewUrl={previewUrl}
              setPreviewUrl={setPreviewUrl}
            />
          </div>

          {/* Settings card */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-rose-100 shadow-sm flex flex-col gap-5">
            <h2 className="text-base font-semibold text-gray-700 flex items-center gap-2">
              ⚙️ Pattern Settings
            </h2>

            {/* Grid size */}
            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">
                Grid Width&nbsp;
                <span className="text-rose-500 font-bold">{gridSize} cells</span>
              </p>
              <div className="flex gap-2 flex-wrap">
                {[30, 50, 80, 100].map((s) => (
                  <button
                    key={s}
                    onClick={() => setGridSize(s)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                      ${gridSize === s
                        ? 'bg-rose-400 text-white shadow'
                        : 'bg-rose-100 text-rose-600 hover:bg-rose-200'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Colour count */}
            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">
                Thread Colours&nbsp;
                <span className="text-purple-500 font-bold">{numColors}</span>
              </p>
              <input
                type="range" min="5" max="30" value={numColors}
                onChange={(e) => setNumColors(Number(e.target.value))}
                className="w-full accent-purple-400"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>5 — simple</span><span>30 — detailed</span>
              </div>
            </div>

            {/* Tips */}
            <div className="mt-auto pt-3 border-t border-rose-100 text-xs text-gray-400 space-y-1">
              <p>🎨 Colours mapped to real DMC thread codes</p>
              <p>📐 Larger grid = more stitches, more detail</p>
              <p>🤖 fal.ai styles your image before processing</p>
            </div>
          </div>
        </div>

        {/* ── Error ────────────────────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* ── Loading ──────────────────────────────────────────────────────── */}
        {loading && <LoadingSpinner />}

        {/* ── Pattern results ──────────────────────────────────────────────── */}
        {pattern && !loading && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-gray-700">Your Cross-Stitch Pattern</h2>
              <span className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">
                {pattern.width}×{pattern.height} &nbsp;•&nbsp; {pattern.colors.length} colours
              </span>
              <span className="bg-purple-100 text-purple-700 text-xs font-semibold px-3 py-1 rounded-full">
                {(pattern.width * pattern.height).toLocaleString()} stitches
              </span>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
              <div className="xl:col-span-3">
                <PatternGrid
                  grid={pattern.grid}
                  colors={pattern.colors}
                  width={pattern.width}
                  height={pattern.height}
                  highlighted={highlighted}
                />
              </div>
              <div>
                <ColorLegend
                  colors={pattern.colors}
                  highlighted={highlighted}
                  onHighlight={(id) => setHighlighted(id === highlighted ? null : id)}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────────────────────── */}
        {!pattern && !loading && !error && (
          <div className="text-center py-20 text-gray-400">
            <div className="text-7xl mb-4 select-none">🪡</div>
            <p className="text-xl font-medium">Upload an image to get started</p>
            <p className="text-sm mt-2">Supports JPG, PNG, WebP — up to 10 MB</p>
          </div>
        )}

      </main>
    </div>
  );
}
