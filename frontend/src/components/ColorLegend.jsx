import { useState } from 'react';
import { T } from '../design/tokens';
import { Ico } from '../design/icons';

export default function ColorLegend({ colors, highlighted, onHighlight }) {
  const [search, setSearch] = useState('');

  const filtered = colors.filter(
    (c) =>
      c.dmcCode?.toLowerCase().includes(search.toLowerCase()) ||
      c.dmcName?.toLowerCase().includes(search.toLowerCase())
  );

  const totalStitches = colors.reduce((s, c) => s + c.count, 0);

  return (
    <div style={{
      background: T.paper, borderRadius: 28, padding: 18,
      border: `1px solid ${T.line}`, boxShadow: T.shadowSm,
      display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: 660,
    }}>
      <div style={{ padding: '4px 8px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Thread legend</div>
          <div style={{ fontSize: 11, color: T.inkMute }}>{colors.length} colours</div>
        </div>

        <div style={{
          marginTop: 10, display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 12px', background: T.creamDeep, borderRadius: 12,
          color: T.inkSoft,
        }}>
          <Ico.search s={14}/>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search DMC code or name…"
            style={{
              flex: 1, border: 'none', background: 'transparent', outline: 'none',
              fontSize: 13, color: T.ink, fontFamily: T.sans,
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 4px' }}>
        {filtered.map((color) => {
          const isHl = highlighted === color.id;
          const pct = totalStitches > 0 ? ((color.count / totalStitches) * 100).toFixed(1) : '0.0';

          return (
            <button
              key={color.id}
              onClick={() => onHighlight(color.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                padding: '10px 10px', borderRadius: 12,
                background: isHl ? T.rose : 'transparent',
                marginBottom: 2, border: 'none', cursor: 'pointer',
                textAlign: 'left', fontFamily: T.sans,
                transition: 'background .15s',
              }}
              onMouseEnter={(e) => { if (!isHl) e.currentTarget.style.background = T.creamDeep; }}
              onMouseLeave={(e) => { if (!isHl) e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: color.dmcHex || color.hex,
                border: `1px solid ${T.line}`, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, color: 'rgba(61,52,48,.6)',
              }}>{color.symbol}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: T.ink }}>{color.dmcCode}</span>
                  <span style={{ fontSize: 12, color: T.inkSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{color.dmcName}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, height: 4 }}>
                  <div style={{ flex: 1, height: 4, borderRadius: 2, background: T.lineSoft, overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(100, parseFloat(pct) * 4)}%`, height: '100%',
                      background: color.dmcHex || color.hex,
                      borderRight: '1px solid rgba(61,52,48,.08)',
                    }}/>
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: T.ink }}>
                  {color.count.toLocaleString()}
                </div>
                <div style={{ fontSize: 10, color: T.inkMute, fontVariantNumeric: 'tabular-nums' }}>{pct}%</div>
              </div>
            </button>
          );
        })}
      </div>

      <div style={{
        padding: '12px 14px', marginTop: 6, borderTop: `1px solid ${T.line}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 12, color: T.inkSoft,
      }}>
        <span><span style={{ fontWeight: 700, color: T.ink }}>{colors.length}</span> colours used</span>
        <span><span style={{ fontWeight: 700, color: T.ink }}>{totalStitches.toLocaleString()}</span> stitches total</span>
      </div>
    </div>
  );
}
