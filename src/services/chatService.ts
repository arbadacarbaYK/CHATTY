import axios from 'axios';
import { config } from '../config/appConfig';
import { getAllKnowledge, searchKnowledge } from './knowledgeService';
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
  conversationHistory?: ChatMessage[];
  knowledgeSources?: Array<{
    url: string;
    title: string;
    content: string;
  }>;
  webSearchResults?: Array<{
    title: string;
    url: string;
    content: string;
    source: string;
  }>;
}

export interface OllamaHealth {
  isRunning: boolean;
  modelAvailable: boolean;
  modelName: string;
  error?: string;
}

export interface SessionInfo {
  userId: string;
  sessionId: string;
  skillLevel: string;
  avatarName: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export class ChatService {
  private static instance: ChatService;
  private healthStatus: OllamaHealth = {
    isRunning: false,
    modelAvailable: false,
    modelName: config.ollama.model
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

  public async checkHealth(): Promise<OllamaHealth> {
    try {
      // Check if Ollama is running through backend to avoid conflicts
      const healthResponse = await axios.get('/chat/health', {
        timeout: 5000
      });

      this.healthStatus = healthResponse.data;
      return this.healthStatus;
    } catch (error: any) {
      console.error('Ollama health check failed:', error);
      
      this.healthStatus.isRunning = false;
      this.healthStatus.modelAvailable = false;
      this.healthStatus.error = error.message;

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
      // Send message to backend API with session management
      const response = await axios.post('/chat/message', {
        message,
        skillLevel,
        avatarName
      }, {
        withCredentials: true, // Include cookies for session
        timeout: 120000 // 120 second timeout for AI responses
      });

      return {
        success: true,
        response: response.data.response,
        conversationHistory: response.data.conversationHistory
      };
    } catch (error: any) {
      console.error('Send message error:', error);
      return {
        success: false,
        response: '',
        error: error.response?.data?.error || error.message || 'Failed to send message'
      };
    }
  }

  public async getConversationHistory(): Promise<ChatMessage[]> {
    try {
      const response = await axios.get('/chat/history', {
        withCredentials: true
      });
      return response.data.conversationHistory || [];
    } catch (error: any) {
      console.error('Get history error:', error);
      return [];
    }
  }

  public async clearConversationHistory(): Promise<boolean> {
    try {
      await axios.post('/chat/clear', {}, {
        withCredentials: true
      });
      return true;
    } catch (error: any) {
      console.error('Clear history error:', error);
      return false;
    }
  }

  public async getSessionInfo(): Promise<SessionInfo | null> {
    try {
      const response = await axios.get('/chat/session-info', {
        withCredentials: true
      });
      return response.data.session;
    } catch (error: any) {
      console.error('Get session info error:', error);
      return null;
    }
  }

  // Legacy methods for backward compatibility
  public clearHistory(): void {
    // This now calls the backend to clear history
    this.clearConversationHistory();
  }

  public getHistory(): ChatMessage[] {
    // This now returns a promise, but we keep the sync version for compatibility
    return [];
  }

  public getHistoryLength(): number {
    // This now returns a promise, but we keep the sync version for compatibility
    return 0;
  }
} 