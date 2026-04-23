import { useRef, useEffect, useState, useCallback } from 'react';
import { T } from '../design/tokens';
import { Pill } from '../design/primitives';
import { Ico } from '../design/icons';

const CELL_SIZES = [4, 6, 8, 10, 14, 18, 24];

export default function PatternGrid({ grid, colors, width, height, highlighted }) {
  const canvasRef = useRef(null);
  const [zoomIdx, setZoomIdx]       = useState(3);
  const [showGrid, setShowGrid]     = useState(true);
  const [showSymbols, setShowSymbols] = useState(true);

  const cellSize = CELL_SIZES[zoomIdx];

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !grid?.length || !colors?.length) return;
    const ctx = canvas.getContext('2d');
    canvas.width  = width  * cellSize;
    canvas.height = height * cellSize;

    // Cell fills
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const cid = grid[row][col];
        const color = colors[cid];
        const x = col * cellSize;
        const y = row * cellSize;
        const dimmed = highlighted !== null && highlighted !== undefined && cid !== highlighted;
        ctx.fillStyle = dimmed ? '#ECE6DC' : (color?.dmcHex || color?.hex || '#ffffff');
        ctx.fillRect(x, y, cellSize, cellSize);

        // Symbols
        if (showSymbols && cellSize >= 10 && !dimmed && color?.symbol) {
          ctx.fillStyle = 'rgba(61,52,48,.55)';
          ctx.font = `${Math.floor(cellSize * 0.65)}px ${T.sans}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(color.symbol, x + cellSize / 2, y + cellSize / 2 + 1);
        }
      }
    }

    // Grid lines
    if (showGrid && cellSize >= 5) {
      for (let r = 0; r <= height; r++) {
        const isMajor = r % 10 === 0;
        ctx.strokeStyle = isMajor ? 'rgba(61,52,48,.35)' : 'rgba(61,52,48,.10)';
        ctx.lineWidth = isMajor ? 0.8 : 0.4;
        ctx.beginPath();
        ctx.moveTo(0, r * cellSize);
        ctx.lineTo(width * cellSize, r * cellSize);
        ctx.stroke();
      }
      for (let c = 0; c <= width; c++) {
        const isMajor = c % 10 === 0;
        ctx.strokeStyle = isMajor ? 'rgba(61,52,48,.35)' : 'rgba(61,52,48,.10)';
        ctx.lineWidth = isMajor ? 0.8 : 0.4;
        ctx.beginPath();
        ctx.moveTo(c * cellSize, 0);
        ctx.lineTo(c * cellSize, height * cellSize);
        ctx.stroke();
      }
    }
  }, [grid, colors, width, height, cellSize, showGrid, showSymbols, highlighted]);

  useEffect(() => { draw(); }, [draw]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = 'cross-stitch-pattern.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  const highlightedColor = highlighted !== null && highlighted !== undefined ? colors[highlighted] : null;

  return (
    <div style={{
      background: T.paper, borderRadius: 28, padding: 20,
      border: `1px solid ${T.line}`, boxShadow: T.shadowSm, position: 'relative',
    }}>
      {/* Floating zoom pill */}
      <div style={{
        position: 'absolute', top: 18, left: 20, zIndex: 2,
        display: 'flex', alignItems: 'center', gap: 4,
        background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(8px)',
        borderRadius: 999, border: `1px solid ${T.line}`, padding: 4,
      }}>
        <button onClick={() => setZoomIdx((i) => Math.max(0, i - 1))}
          disabled={zoomIdx === 0}
          style={{
            width: 32, height: 32, borderRadius: 999, border: 'none',
            background: 'transparent', cursor: zoomIdx === 0 ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: T.inkSoft, opacity: zoomIdx === 0 ? 0.4 : 1,
          }}>
          <Ico.minus s={14}/>
        </button>
        <div style={{ padding: '0 8px', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 50, textAlign: 'center' }}>
          {cellSize} px
        </div>
        <button onClick={() => setZoomIdx((i) => Math.min(CELL_SIZES.length - 1, i + 1))}
          disabled={zoomIdx === CELL_SIZES.length - 1}
          style={{
            width: 32, height: 32, borderRadius: 999, border: 'none',
            background: T.rose, cursor: zoomIdx === CELL_SIZES.length - 1 ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: T.mauveDeep, opacity: zoomIdx === CELL_SIZES.length - 1 ? 0.4 : 1,
          }}>
          <Ico.plus s={14}/>
        </button>
      </div>

      {/* Floating toggles + download */}
      <div style={{ position: 'absolute', top: 18, right: 20, zIndex: 2, display: 'flex', gap: 8 }}>
        <button onClick={() => setShowSymbols(s => !s)} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', borderRadius: 999, border: `1px solid ${T.line}`,
          background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(8px)',
          fontSize: 13, color: T.ink, cursor: 'pointer', fontFamily: T.sans, fontWeight: 500,
        }}>
          <div style={{
            width: 14, height: 14, borderRadius: 3,
            background: showSymbols ? T.mint : T.creamDeep,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: T.successTx, fontSize: 10, fontWeight: 700,
          }}>{showSymbols ? '✓' : ''}</div>
          Symbols
        </button>
        <button onClick={() => setShowGrid(g => !g)} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', borderRadius: 999, border: `1px solid ${T.line}`,
          background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(8px)',
          fontSize: 13, color: T.ink, cursor: 'pointer', fontFamily: T.sans, fontWeight: 500,
        }}>
          <div style={{
            width: 14, height: 14, borderRadius: 3,
            background: showGrid ? T.mint : T.creamDeep,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: T.successTx, fontSize: 10, fontWeight: 700,
          }}>{showGrid ? '✓' : ''}</div>
          Grid
        </button>
        <button onClick={handleDownload} style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '8px 16px', borderRadius: 999, border: 'none',
          background: T.mauve, color: '#fff',
          fontSize: 13, cursor: 'pointer', fontFamily: T.sans, fontWeight: 600,
          boxShadow: '0 2px 4px rgba(176,118,129,.2), 0 6px 14px rgba(176,118,129,.18)',
        }}>
          <Ico.download s={14}/>
          PNG
        </button>
      </div>

      {/* Canvas scroll container */}
      <div style={{
        marginTop: 36, paddingTop: 12,
        overflow: 'auto', maxHeight: 620,
        borderRadius: 14,
      }}>
        <canvas ref={canvasRef} style={{ display: 'block', cursor: 'crosshair', margin: '0 auto' }}/>
      </div>

      {/* Footer caption */}
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12,
        marginTop: 12, color: T.inkSoft, fontSize: 12,
      }}>
        {highlightedColor ? (
          <>
            <span style={{ letterSpacing: 0.5 }}>Viewing:</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, color: T.ink }}>
              <span style={{
                width: 14, height: 14, borderRadius: 4,
                background: highlightedColor.dmcHex || highlightedColor.hex,
                border: `1px solid ${T.line}`,
              }}/>
              DMC {highlightedColor.dmcCode} · {highlightedColor.dmcName}
            </span>
            <span style={{ color: T.inkMute }}>· tap a swatch to clear</span>
          </>
        ) : (
          <span style={{ color: T.inkMute }}>
            {width} × {height} grid · {(width * height).toLocaleString()} stitches · tap a colour to highlight
          </span>
        )}
      </div>
    </div>
  );
}
