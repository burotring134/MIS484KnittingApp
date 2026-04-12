import { useState } from 'react';

export default function ColorLegend({ colors, highlighted, onHighlight }) {
  const [search, setSearch] = useState('');

  const filtered = colors.filter(
    (c) =>
      c.dmcCode?.toLowerCase().includes(search.toLowerCase()) ||
      c.dmcName?.toLowerCase().includes(search.toLowerCase())
  );

  const totalStitches = colors.reduce((s, c) => s + c.count, 0);

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-rose-100 shadow-sm">
      <h3 className="text-base font-semibold text-gray-700 flex items-center gap-2">
        🎨 Thread Legend
      </h3>
      <p className="text-xs text-gray-400 mt-0.5 mb-3">Click a colour to highlight it in the grid</p>

      {/* Search */}
      <input
        type="text"
        placeholder="Search DMC code or name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full text-xs border border-rose-100 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-1 focus:ring-rose-300 bg-white/80"
      />

      {/* Colour rows */}
      <div className="space-y-1 max-h-[480px] overflow-y-auto scrollbar-thin pr-1">
        {filtered.map((color) => {
          const isHighlighted = highlighted === color.id;
          const pct = totalStitches > 0 ? ((color.count / totalStitches) * 100).toFixed(1) : '0.0';

          return (
            <button
              key={color.id}
              onClick={() => onHighlight(color.id)}
              className={`
                w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left transition-all
                ${isHighlighted
                  ? 'bg-rose-100 ring-1 ring-rose-300'
                  : 'hover:bg-rose-50'}
              `}
            >
              {/* Swatch */}
              <div
                className="w-8 h-8 rounded-lg border border-gray-200 flex-shrink-0 shadow-sm"
                style={{ backgroundColor: color.dmcHex || color.hex }}
              />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-gray-700">DMC {color.dmcCode}</span>
                  <span className="text-[10px] bg-rose-100 text-rose-600 rounded px-1.5 py-0.5 font-mono font-semibold">
                    #{color.id + 1}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 truncate leading-tight">{color.dmcName}</p>
                {/* Progress bar */}
                <div className="mt-1 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-300 to-purple-400"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Count */}
              <div className="text-right flex-shrink-0">
                <p className="text-xs font-semibold text-gray-600">{color.count.toLocaleString()}</p>
                <p className="text-[10px] text-gray-400">{pct}%</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer totals */}
      <div className="mt-3 pt-3 border-t border-rose-100 flex justify-between items-center text-xs text-gray-400">
        <span>{colors.length} colours used</span>
        <span>{totalStitches.toLocaleString()} stitches total</span>
      </div>
    </div>
  );
}
