import axios from 'axios';
import { config } from '../config/appConfig';
import { getSettings } from '../lib/userSettings';

export type ModelKind = 'tutor' | 'coder' | 'unfiltered' | 'other';

export interface OllamaModelInfo {
  name: string;
  /** Short label for the picker */
  label: string;
  kind: ModelKind;
  size?: number;
}

function ollamaBase(): string {
  const url = config.ollama.url.replace(/\/$/, '');
  if (url.endsWith('/api') || url === '/api') return url;
  return `${url}/api`;
}

function classifyModel(name: string): { label: string; kind: ModelKind } {
  const n = name.toLowerCase();
  if (
    n === 'lab-coder' ||
    n.includes('coder') ||
    n.includes('code')
  ) {
    if (n.includes('abliterat') || n === 'lab-smart' || n === 'lab-security') {
      return { label: friendlyName(name, 'Coder / unfiltered'), kind: 'unfiltered' };
    }
    return { label: friendlyName(name, 'Coder'), kind: 'coder' };
  }
  if (
    n === 'lab-smart' ||
    n === 'lab-security' ||
    n.includes('lab-security') ||
    n.includes('abliterat') ||
    n.includes('unhinged') ||
    n.includes('uncensor') ||
    n.includes('whiterabbit')
  ) {
    return { label: friendlyName(name, 'Unfiltered (lab)'), kind: 'unfiltered' };
  }
  if (
    n.includes('llama3.2:3b') ||
    n.includes('llama3.2:1b') ||
    n === 'lab-fast' ||
    n.includes('deephat')
  ) {
    return { label: friendlyName(name, 'Tutor (fast)'), kind: 'tutor' };
  }
  return { label: name, kind: 'other' };
}

function friendlyName(name: string, role: string): string {
  // Keep short alias visible: "lab-coder · Coder"
  if (name.startsWith('lab-') || name.length < 28) {
    return `${name} · ${role}`;
  }
  const short = name.length > 36 ? `${name.slice(0, 34)}…` : name;
  return `${short} · ${role}`;
}

export async function listOllamaModels(): Promise<OllamaModelInfo[]> {
  const res = await axios.get(`${ollamaBase()}/tags`, { timeout: 5000 });
  const models = (res.data?.models || []) as Array<{ name?: string; size?: number }>;
  const mapped = models
    .filter((m) => m.name)
    .map((m) => {
      const { label, kind } = classifyModel(m.name!);
      return { name: m.name!, label, kind, size: m.size };
    })
    .sort((a, b) => {
      const order: Record<ModelKind, number> = {
        tutor: 0,
        coder: 1,
        unfiltered: 2,
        other: 3,
      };
      return order[a.kind] - order[b.kind] || a.name.localeCompare(b.name);
    });
  return mapped;
}

/** Prefer settings default, then env default, then first installed model. */
export function resolveActiveModel(installed: OllamaModelInfo[], override?: string | null): string {
  if (override && installed.some((m) => m.name === override)) return override;
  const settingsDefault = getSettings().defaultModel;
  if (installed.some((m) => m.name === settingsDefault)) return settingsDefault;
  if (installed.some((m) => m.name === config.ollama.model)) return config.ollama.model;
  return installed[0]?.name || config.ollama.model;
}
