import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ModelPicker } from './ModelPicker';
import {
  getSettings,
  saveSettings,
  type ChattySettings,
} from '../lib/userSettings';

interface SettingsPanelProps {
  /** When embedded as a slide-over / dropdown */
  onClose?: () => void;
  compact?: boolean;
}

export function SettingsPanel({ onClose, compact }: SettingsPanelProps) {
  const [settings, setSettings] = useState<ChattySettings>(() => getSettings());

  useEffect(() => {
    setSettings(getSettings());
  }, []);

  const update = (patch: Partial<ChattySettings>) => {
    setSettings(saveSettings(patch));
  };

  return (
    <div
      className={`text-left text-orange-100 ${
        compact
          ? 'p-4 bg-[#1a1030]/90 border border-orange-500/30 rounded-xl shadow-xl max-w-md'
          : 'p-6 bg-white/10 backdrop-blur-lg rounded-2xl max-w-xl mx-auto border border-white/10'
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Settings</h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-orange-300 hover:text-white text-sm"
          >
            Close
          </button>
        )}
      </div>

      <section className="space-y-4">
        <div>
          <label className="block text-sm text-orange-200 mb-1.5">Default model</label>
          <p className="text-xs text-orange-300/60 mb-2">
            Used for each new question unless you change the model in the chat bar (per-message
            override, like Cursor).
          </p>
          <ModelPicker
            value={settings.defaultModel}
            onChange={(defaultModel) => update({ defaultModel })}
          />
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1"
            checked={settings.speakRepliesDefault}
            onChange={(e) => update({ speakRepliesDefault: e.target.checked })}
          />
          <span>
            <span className="text-sm text-orange-100">Speak replies by default</span>
            <span className="block text-xs text-orange-300/60">
              Turns on 🔊 when you open chat (browser voice or local espeak).
            </span>
          </span>
        </label>

        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={settings.allowFileEdits}
              onChange={(e) => update({ allowFileEdits: e.target.checked })}
            />
            <span>
              <span className="text-sm text-orange-100">Allow file-edit proposals</span>
              <span className="block text-xs text-orange-300/60">
                Off by default. When on, the AI may propose patches only under the root you set —
                you still approve each apply. Never paste seeds or nsecs into chat.
              </span>
            </span>
          </label>
          <div>
            <label className="block text-xs text-orange-200 mb-1">Allowed edit root</label>
            <input
              type="text"
              disabled={!settings.allowFileEdits}
              value={settings.fileEditRoot}
              onChange={(e) => update({ fileEditRoot: e.target.value })}
              placeholder="e.g. /home/you/Projects/CHATTY"
              className="w-full px-3 py-2 rounded-lg bg-black/40 border border-orange-500/20 text-sm text-orange-100 placeholder-orange-300/40 disabled:opacity-40"
            />
            <p className="text-[10px] text-orange-300/50 mt-1">
              File apply tools are prepared in settings; sandbox writes land in a follow-up build.
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-white/10 text-xs text-orange-300/70 space-y-1">
          <p>Knowledge admin: <Link to="/input" className="underline text-orange-200">/input</Link></p>
          <p>All models are local Ollama — nothing is sent to a cloud API from CHATTY.</p>
        </div>
      </section>
    </div>
  );
}
