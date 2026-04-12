import { useState, useRef } from 'react';

export default function ImageUploader({ onGenerate, loading, previewUrl, setPreviewUrl }) {
  const [isDragging, setIsDragging] = useState(false);
  const [file,       setFile]       = useState(null);
  const inputRef = useRef(null);

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

  const handleGenerate = () => {
    if (file && !loading) onGenerate(file);
  };

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-rose-100 shadow-sm flex flex-col gap-4">
      <h2 className="text-base font-semibold text-gray-700 flex items-center gap-2">
        📷 Upload Image
      </h2>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !loading && inputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-xl transition-all cursor-pointer overflow-hidden
          ${isDragging ? 'border-rose-400 bg-rose-50 scale-[1.01]' : 'border-rose-200 hover:border-rose-300 hover:bg-rose-50/40'}
          ${previewUrl ? 'h-72' : 'h-52'}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => applyFile(e.target.files[0])}
        />

        {previewUrl ? (
          <>
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full h-full object-contain"
            />
            {/* Overlay hint */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20 rounded-xl">
              <p className="text-white font-medium text-sm bg-black/40 px-4 py-2 rounded-lg">
                Click to change image
              </p>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-2">
            <span className="text-5xl select-none">🖼️</span>
            <p className="font-medium">Drop your image here, or click to browse</p>
            <p className="text-sm">JPG · PNG · WebP — max 10 MB</p>
          </div>
        )}
      </div>

      {/* File info */}
      {file && (
        <p className="text-xs text-gray-400 truncate">
          {file.name} &nbsp;·&nbsp; {(file.size / 1024).toFixed(0)} KB
        </p>
      )}

      {/* CTA */}
      <button
        onClick={handleGenerate}
        disabled={!file || loading}
        className={`
          w-full py-3 rounded-xl font-semibold text-white transition-all text-sm
          ${file && !loading
            ? 'bg-gradient-to-r from-rose-400 to-purple-500 hover:from-rose-500 hover:to-purple-600 shadow-md hover:shadow-lg active:scale-[0.98]'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'}
        `}
      >
        {loading ? '⏳  Generating pattern…' : '✨  Generate Cross-Stitch Pattern'}
      </button>
    </div>
  );
}
