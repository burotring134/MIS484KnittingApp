import { useRef, useEffect, useState, useCallback } from 'react';

const CELL_SIZES = [3, 5, 7, 10, 13, 16, 20];

export default function PatternGrid({ grid, colors, width, height, highlighted }) {
  const canvasRef  = useRef(null);
  const [zoomIdx,  setZoomIdx]  = useState(3);   // default 10 px/cell
  const [showGrid, setShowGrid] = useState(true);

  const cellSize = CELL_SIZES[zoomIdx];

  // ── draw ──────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !grid?.length || !colors?.length) return;

    const ctx = canvas.getContext('2d');
    canvas.width  = width  * cellSize;
    canvas.height = height * cellSize;

    // Fill cells
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const cid   = grid[row][col];
        const color = colors[cid];
        const x     = col * cellSize;
        const y     = row * cellSize;

        const dimmed = highlighted !== null && highlighted !== undefined && cid !== highlighted;
        ctx.fillStyle = dimmed ? '#ececec' : (color?.dmcHex || color?.hex || '#ffffff');
        ctx.fillRect(x, y, cellSize, cellSize);

        // Cross symbol when large enough
        if (cellSize >= 10 && !dimmed) {
          ctx.strokeStyle = 'rgba(0,0,0,0.18)';
          ctx.lineWidth   = 0.7;
          ctx.beginPath();
          ctx.moveTo(x + 2,            y + 2);
          ctx.lineTo(x + cellSize - 2, y + cellSize - 2);
          ctx.moveTo(x + cellSize - 2, y + 2);
          ctx.lineTo(x + 2,            y + cellSize - 2);
          ctx.stroke();
        }
      }
    }

    // Grid lines
    if (showGrid && cellSize >= 5) {
      ctx.strokeStyle = 'rgba(0,0,0,0.10)';
      ctx.lineWidth   = 0.5;
      for (let r = 0; r <= height; r++) {
        ctx.beginPath();
        ctx.moveTo(0,           r * cellSize);
        ctx.lineTo(width * cellSize, r * cellSize);
        ctx.stroke();
      }
      for (let c = 0; c <= width; c++) {
        ctx.beginPath();
        ctx.moveTo(c * cellSize, 0);
        ctx.lineTo(c * cellSize, height * cellSize);
        ctx.stroke();
      }
    }
  }, [grid, colors, width, height, cellSize, showGrid, highlighted]);

  useEffect(() => { draw(); }, [draw]);

  // ── download ──────────────────────────────────────────────────────────────
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = 'cross-stitch-pattern.png';
    a.href     = canvas.toDataURL('image/png');
    a.click();
  };

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-rose-100 shadow-sm flex flex-col gap-4">

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Zoom */}
        <div className="flex items-center gap-1 bg-rose-50 rounded-lg p-1">
          <button
            onClick={() => setZoomIdx((i) => Math.max(0, i - 1))}
            disabled={zoomIdx === 0}
            className="w-7 h-7 rounded flex items-center justify-center text-rose-600 hover:bg-rose-100 disabled:opacity-30 font-bold text-lg leading-none"
          >−</button>
          <span className="text-xs text-gray-600 font-medium w-16 text-center">{cellSize} px/cell</span>
          <button
            onClick={() => setZoomIdx((i) => Math.min(CELL_SIZES.length - 1, i + 1))}
            disabled={zoomIdx === CELL_SIZES.length - 1}
            className="w-7 h-7 rounded flex items-center justify-center text-rose-600 hover:bg-rose-100 disabled:opacity-30 font-bold text-lg leading-none"
          >+</button>
        </div>

        {/* Grid toggle */}
        <button
          onClick={() => setShowGrid((g) => !g)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
            ${showGrid ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'}`}
        >
          {showGrid ? '# Grid ON' : '# Grid OFF'}
        </button>

        {/* Download */}
        <button
          onClick={handleDownload}
          className="ml-auto px-4 py-1.5 bg-gradient-to-r from-rose-400 to-purple-500 text-white rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          ⬇ Download PNG
        </button>
      </div>

      {/* Canvas scroll container */}
      <div className="overflow-auto max-h-[620px] border border-rose-100 rounded-xl bg-white scrollbar-thin">
        <canvas ref={canvasRef} className="block cursor-crosshair" />
      </div>

      <p className="text-xs text-gray-400 text-right">
        {width}×{height} grid &nbsp;=&nbsp; {(width * height).toLocaleString()} total stitches
      </p>
    </div>
  );
}
