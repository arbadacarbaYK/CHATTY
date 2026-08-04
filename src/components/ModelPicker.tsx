import { useEffect, useRef, useState } from 'react';
import {
  listOllamaModels,
  type OllamaModelInfo,
  type ModelKind,
} from '../services/ollamaModels';

const KIND_HINT: Record<ModelKind, string> = {
  tutor: 'Careful tutor tone',
  coder: 'Better at code / scripts',
  unfiltered: 'Fewer safety rails — still local; never paste seeds',
  other: 'Installed Ollama model',
};

interface ModelPickerProps {
  value: string;
  onChange: (model: string) => void;
  /** Compact for chat composer (Cursor-style) */
  compact?: boolean;
  className?: string;
  disabled?: boolean;
}

export function ModelPicker({
  value,
  onChange,
  compact = false,
  className = '',
  disabled = false,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<OllamaModelInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await listOllamaModels();
      setModels(list);
      setError(list.length ? null : 'No models in Ollama — run ollama pull …');
      if (list.length && !list.some((m) => m.name === value)) {
        onChange(list[0].name);
      }
    } catch {
      setError('Cannot reach Ollama');
      setModels([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const current = models.find((m) => m.name === value);
  const display = current?.label || value || (loading ? 'Loading…' : 'Select model');

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => {
          setOpen((o) => !o);
          if (!open) refresh();
        }}
        className={`flex items-center gap-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
          compact
            ? 'px-2.5 py-1.5 text-xs bg-black/30 border-white/10 text-orange-100 hover:border-orange-400/40 max-w-[14rem]'
            : 'px-3 py-2 text-sm bg-black/30 border-orange-500/30 text-orange-100 hover:border-orange-400 w-full justify-between'
        }`}
        title={current ? KIND_HINT[current.kind] : 'Choose Ollama model'}
      >
        <span className="truncate">{display}</span>
        <span className="opacity-60 shrink-0">▾</span>
      </button>

      {open && (
        <div
          className={`absolute z-40 mt-1 rounded-xl border border-orange-500/30 bg-[#1a1030] shadow-xl overflow-hidden ${
            compact ? 'bottom-full mb-1 left-0 min-w-[16rem] max-w-[20rem]' : 'left-0 right-0'
          }`}
        >
          <div className="px-3 py-2 text-[10px] uppercase tracking-wide text-orange-300/60 border-b border-white/5">
            Local Ollama models
          </div>
          {error && (
            <div className="px-3 py-2 text-xs text-yellow-300 border-b border-white/5">{error}</div>
          )}
          <ul className="max-h-56 overflow-y-auto py-1">
            {models.map((m) => (
              <li key={m.name}>
                <button
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-orange-500/15 ${
                    m.name === value ? 'bg-orange-500/20 text-orange-200' : 'text-orange-100'
                  }`}
                  onClick={() => {
                    onChange(m.name);
                    setOpen(false);
                  }}
                >
                  <div className="truncate font-medium">{m.label}</div>
                  <div className="text-[10px] text-orange-300/60 mt-0.5">
                    {KIND_HINT[m.kind]}
                    {m.kind === 'unfiltered' ? ' · use with care' : ''}
                  </div>
                </button>
              </li>
            ))}
            {!models.length && !loading && (
              <li className="px-3 py-3 text-xs text-orange-300/70">No models found</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
