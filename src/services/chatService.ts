import axios from 'axios';
import { config } from '../config/appConfig';
import { searchKnowledge } from './knowledgeService';
import type { KnowledgeLink } from './knowledgeService';

export interface ChatMessage {
  sender: 'user' | 'avatar';
  text: string;
  timestamp: number;
}

export interface ChatResponse {
  response: string;
  success: boolean;
  error?: string;
  sources?: Array<{ url: string; title?: string }>;
  knowledgeMs?: number;
}

export interface OllamaHealth {
  isRunning: boolean;
  modelAvailable: boolean;
  modelName: string;
  error?: string;
}

/** Skip KB for chit-chat — search would only add latency. */
function shouldQueryKnowledge(message: string): boolean {
  const q = message.trim().toLowerCase();
  if (q.length < 12) return false;
  if (/^(hi|hello|hey|thanks|thank you|ok|okay|bye)\b/.test(q)) return false;
  return /bitcoin|btc|lightning|ln |lnurl|nostr|cashu|ecash|wallet|coldcard|coinkite|bip|taproot|seed|entropy|soft\s*fork|op_return|node|relay|zap|nwc|fedimint|hardware|mnemonic|passphrase|utxo|mempool|knot|core\b|miner|mining|ordinal|inscription/i.test(
    q
  );
}

function excerptForPrompt(content: string, query: string, maxLen = 700): string {
  if (!content) return '';
  const cleaned = content.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLen) return cleaned;

  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const lower = cleaned.toLowerCase();
  let bestIdx = -1;
  for (const word of words) {
    const idx = lower.indexOf(word);
    if (idx >= 0 && (bestIdx < 0 || idx < bestIdx)) bestIdx = idx;
  }
  if (bestIdx < 0) return `${cleaned.slice(0, maxLen)}...`;
  const start = Math.max(0, bestIdx - Math.floor(maxLen / 4));
  const slice = cleaned.slice(start, start + maxLen);
  return `${start > 0 ? '...' : ''}${slice}${start + maxLen < cleaned.length ? '...' : ''}`;
}

export class ChatService {
  private static instance: ChatService;
  private conversationHistory: ChatMessage[] = [];
  private healthStatus: OllamaHealth = {
    isRunning: false,
    modelAvailable: false,
    modelName: config.ollama.model,
  };

  private constructor() {
    this.checkHealth();
  }

  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  private ollamaBase(): string {
    const url = config.ollama.url.replace(/\/$/, '');
    if (url.endsWith('/api') || url === '/api') return url;
    return `${url}/api`;
  }

  public async checkHealth(): Promise<OllamaHealth> {
    try {
      const healthResponse = await axios.get(`${this.ollamaBase()}/tags`, {
        timeout: 5000,
      });

      this.healthStatus.isRunning = true;
      const models = healthResponse.data.models || [];
      const ourModel = models.find(
        (m: { name?: string }) =>
          m.name === config.ollama.model || m.name?.startsWith(`${config.ollama.model}:`)
      );

      this.healthStatus.modelAvailable = !!ourModel;
      this.healthStatus.modelName = config.ollama.model;
      this.healthStatus.error = undefined;

      return this.healthStatus;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Ollama health check failed:', error);
      this.healthStatus.isRunning = false;
      this.healthStatus.modelAvailable = false;
      this.healthStatus.error = message;
      return this.healthStatus;
    }
  }

  public getHealthStatus(): OllamaHealth {
    return { ...this.healthStatus };
  }

  public async sendMessage(
    message: string,
    skillLevel: 'beginner' | 'intermediate' | 'advanced',
    avatarName: string = 'Satoshe'
  ): Promise<ChatResponse> {
    try {
      const userMessage: ChatMessage = {
        sender: 'user',
        text: message,
        timestamp: Date.now(),
      };
      this.conversationHistory.push(userMessage);

      if (this.conversationHistory.length > config.chat.maxHistoryLength) {
        this.conversationHistory = this.conversationHistory.slice(
          -config.chat.maxHistoryLength
        );
      }

      let relevantKnowledge: KnowledgeLink[] = [];
      let knowledgeMs = 0;
      try {
        const t0 = performance.now();
        relevantKnowledge = await this.getRelevantKnowledge(message);
        knowledgeMs = Math.round(performance.now() - t0);
        console.log(
          `Knowledge: ${relevantKnowledge.length} sources in ${knowledgeMs}ms for "${message.slice(0, 60)}"`
        );
      } catch (error) {
        console.warn('Knowledge base query failed, continuing without context:', error);
      }

      const systemPrompt = this.createSystemPrompt(
        skillLevel,
        relevantKnowledge,
        avatarName,
        message
      );

      const recentMessages = this.conversationHistory.slice(-8);
      const conversationContext = recentMessages
        .map((msg) => `${msg.sender === 'user' ? 'User' : avatarName}: ${msg.text}`)
        .join('\n');

      const fullPrompt = `${systemPrompt}

Current conversation:
${conversationContext}

${avatarName}:`;

      const response = await axios.post(
        `${this.ollamaBase()}/generate`,
        {
          model: config.ollama.model,
          prompt: fullPrompt,
          stream: false,
          options: {
            temperature: 0.5,
            num_predict: 700,
            num_ctx: relevantKnowledge.length > 0 ? 6144 : 4096,
            num_thread: 4,
          },
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: config.ollama.timeout,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }
      );

      const responseText = String(response.data.response || '').trim();
      const avatarMessage: ChatMessage = {
        sender: 'avatar',
        text: responseText,
        timestamp: Date.now(),
      };
      this.conversationHistory.push(avatarMessage);

      return {
        response: responseText,
        success: true,
        knowledgeMs,
        sources: relevantKnowledge.slice(0, 3).map((k) => ({
          url: k.url,
        })),
      };
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      console.error('Ollama API Error:', error);

      if (err.code === 'ECONNREFUSED' || err.message?.includes('connect')) {
        return {
          response:
            "I can't reach the local AI (Ollama). Install from https://ollama.com, run `ollama serve`, then `ollama pull llama3.2:3b`.",
          success: false,
          error: 'Connection refused',
        };
      }

      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        return {
          response:
            'The local model timed out (common on the first load). Wait a few seconds and try again.',
          success: false,
          error: 'Timeout',
        };
      }

      if (err.message?.includes('model') || err.message?.includes('not found')) {
        return {
          response: `Model missing. Run: ollama pull ${config.ollama.model}`,
          success: false,
          error: 'Model not found',
        };
      }

      return {
        response: "I'm having trouble answering right now. Please try again.",
        success: false,
        error: err.message,
      };
    }
  }

  private async getRelevantKnowledge(userQuery: string): Promise<KnowledgeLink[]> {
    if (!shouldQueryKnowledge(userQuery)) {
      return [];
    }

    try {
      const timeoutMs = 1200;
      const timeoutPromise = new Promise<KnowledgeLink[]>((_, reject) => {
        setTimeout(() => reject(new Error('Knowledge base query timeout')), timeoutMs);
      });

      const queryPromise = (async () => {
        const searchResults = await searchKnowledge(userQuery);
        return searchResults
          .filter((k) => k.status === 'crawled' && (k.content?.length || 0) >= 400)
          .slice(0, 3);
      })();

      return await Promise.race([queryPromise, timeoutPromise]);
    } catch (error) {
      console.warn('Knowledge skipped (timeout or error):', error);
      return [];
    }
  }

  private createSystemPrompt(
    skillLevel: 'beginner' | 'intermediate' | 'advanced',
    relevantKnowledge: KnowledgeLink[],
    avatarName: string,
    userQuery: string
  ): string {
    const basePrompt = `You are ${avatarName}, a careful local Bitcoin ecosystem tutor (Bitcoin, Lightning, Nostr, Cashu/ecash, related open-source tools).

Rules:
- Prefer the LOCAL KNOWLEDGE excerpts below when they answer the question. Cite them as numbered sources like [1], [2].
- Present contested topics (e.g. BIP-110, vendor incidents) as debates: what proponents claim, what critics claim, and what is still uncertain. Do not pick a tribe.
- For security incidents (e.g. Coldcard entropy): stress official vendor guidance, that firmware updates do not fix old seeds, and never ask for seeds/keys.
- If knowledge is missing or thin, say what you are unsure about. Do not invent product claims, URLs, or security guarantees.
- Never ask for seed phrases, private keys, or nsecs. Never give personalized financial advice; educate only.
- Stay in character as ${avatarName}. Be clear and encouraging.`;

    let knowledgeContext = '';
    if (relevantKnowledge.length > 0) {
      knowledgeContext = '\n\nLOCAL KNOWLEDGE (use preferentially; keep quotes short):\n';
      relevantKnowledge.forEach((knowledge, index) => {
        knowledgeContext += `[${index + 1}] ${knowledge.url}\n`;
        if (knowledge.content) {
          knowledgeContext += `Excerpt: ${excerptForPrompt(knowledge.content, userQuery, 700)}\n`;
        }
        knowledgeContext += '\n';
      });
    } else {
      knowledgeContext =
        '\n\nLOCAL KNOWLEDGE: none matched (or skipped for speed). Answer carefully from general knowledge and say when you may be guessing.\n';
    }

    const skillPrompts = {
      beginner: `${basePrompt}${knowledgeContext}
Audience: beginner. Simple language, short analogies, avoid jargon (or explain it). Aim under ~180 words.`,
      intermediate: `${basePrompt}${knowledgeContext}
Audience: intermediate. Practical detail (wallets, fees, Lightning, relays) is OK. Aim under ~280 words.`,
      advanced: `${basePrompt}${knowledgeContext}
Audience: advanced. Technical depth OK (protocols, privacy tradeoffs, ops). Aim under ~400 words.`,
    };

    return skillPrompts[skillLevel];
  }

  public clearHistory(): void {
    this.conversationHistory = [];
  }

  public getHistory(): ChatMessage[] {
    return [...this.conversationHistory];
  }

  public getHistoryLength(): number {
    return this.conversationHistory.length;
  }
}
