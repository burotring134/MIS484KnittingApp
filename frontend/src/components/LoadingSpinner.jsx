import { useState, useEffect } from 'react';

const STEPS = [
  { icon: '⬆️', label: 'Uploading image to fal.ai storage…'       },
  { icon: '🤖', label: 'AI converting to cross-stitch style…'      },
  { icon: '📐', label: 'Resizing to pattern grid…'                  },
  { icon: '🎨', label: 'Running K-means colour quantisation…'       },
  { icon: '🧵', label: 'Mapping to DMC thread colours…'             },
  { icon: '📋', label: 'Building final pattern grid…'               },
];

export default function LoadingSpinner() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStep((s) => (s + 1 < STEPS.length ? s + 1 : s));
    }, 3500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-10 border border-rose-100 shadow-sm flex flex-col items-center gap-6">

      {/* Spinner */}
      <div className="relative w-24 h-24">
        <div className="absolute inset-0 rounded-full border-4 border-rose-100" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-rose-400 border-r-purple-400 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center text-4xl select-none">🪡</div>
      </div>

      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-700">Weaving your pattern…</h3>
        <p className="text-sm text-gray-400 mt-1">
          The AI is processing your image — this may take up to 30 seconds
        </p>
      </div>

      {/* Step list */}
      <div className="w-full max-w-sm space-y-2">
        {STEPS.map((s, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-500
              ${i < step  ? 'opacity-60' : ''}
              ${i === step ? 'bg-rose-50 ring-1 ring-rose-200' : ''}
              ${i > step  ? 'opacity-25' : ''}
            `}
          >
            <span className="text-xl w-7 text-center select-none">{s.icon}</span>
            <span className={`text-sm flex-1 ${i === step ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
              {s.label}
            </span>
            {i < step && <span className="text-green-500 font-bold text-sm">✓</span>}
            {i === step && (
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse flex-shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
