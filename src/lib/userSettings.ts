/** User preferences persisted in localStorage (defaults + feature flags). */

export type ChattySettings = {
  /** Default Ollama model tag for new chats / messages */
  defaultModel: string;
  /** Prefer spoken replies when opening chat */
  speakRepliesDefault: boolean;
  /**
   * Allow the tutor to propose local file edits (off by default).
   * Writes stay sandboxed to fileEditRoot when enabled — apply is always explicit.
   */
  allowFileEdits: boolean;
  /** Absolute or ~ path root for future file tools; empty = disabled until set */
  fileEditRoot: string;
};

const STORAGE_KEY = 'chatty.settings.v1';
const CHANGE_EVENT = 'chatty-settings-changed';

export const DEFAULT_SETTINGS: ChattySettings = {
  defaultModel: 'llama3.2:3b',
  speakRepliesDefault: false,
  allowFileEdits: false,
  fileEditRoot: '',
};

function readRaw(): Partial<ChattySettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<ChattySettings>;
  } catch {
    return {};
  }
}

export function getSettings(): ChattySettings {
  return { ...DEFAULT_SETTINGS, ...readRaw() };
}

export function saveSettings(patch: Partial<ChattySettings>): ChattySettings {
  const next = { ...getSettings(), ...patch };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
  return next;
}

export function subscribeSettings(cb: (s: ChattySettings) => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<ChattySettings>).detail;
    cb(detail || getSettings());
  };
  const storageHandler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb(getSettings());
  };
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener('storage', storageHandler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener('storage', storageHandler);
  };
}
