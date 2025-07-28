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
}

export interface OllamaHealth {
  isRunning: boolean;
  modelAvailable: boolean;
  modelName: string;
  error?: string;
}

export class ChatService {
  private static instance: ChatService;
  private conversationHistory: ChatMessage[] = [];
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
      // Check if Ollama is running
      const healthResponse = await axios.get(`${config.ollama.url}/tags`, {
        timeout: 5000
      });

      this.healthStatus.isRunning = true;

      // Check if our model is available
      const models = healthResponse.data.models || [];
      const ourModel = models.find((m: any) => m.name === config.ollama.model);
      
      this.healthStatus.modelAvailable = !!ourModel;
      this.healthStatus.modelName = config.ollama.model;

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
      // Health check is now handled in the UI component on mount
      // No need to check health before every message

      // Add user message to history
      const userMessage: ChatMessage = { 
        sender: 'user', 
        text: message,
        timestamp: Date.now()
      };
      this.conversationHistory.push(userMessage);

      // Limit history length
      if (this.conversationHistory.length > config.chat.maxHistoryLength) {
        this.conversationHistory = this.conversationHistory.slice(-config.chat.maxHistoryLength);
      }

      // Get relevant knowledge for this query
      let relevantKnowledge: KnowledgeLink[] = [];
      try {
        relevantKnowledge = await this.getRelevantKnowledge(message);
        console.log(`Found ${relevantKnowledge.length} relevant knowledge sources for query: "${message}"`);
      } catch (error) {
        console.warn('Knowledge base query failed, continuing without context:', error);
        // Continue without knowledge base if it fails
      }

      // Create system prompt based on skill level
      const systemPrompt = this.createSystemPrompt(skillLevel, relevantKnowledge, avatarName);

      // Prepare conversation context (last 2 messages to keep context manageable)
      const recentMessages = this.conversationHistory.slice(-2);
      const conversationContext = recentMessages
        .map(msg => `${msg.sender === 'user' ? 'User' : avatarName}: ${msg.text}`)
        .join('\n');

      // Create the full prompt for Ollama
      const fullPrompt = `${systemPrompt}

Current conversation:
${conversationContext}

${avatarName}:`;

      const response = await axios.post(
        `${config.ollama.url}/generate`,
        {
          model: config.ollama.model,
          prompt: fullPrompt,
          stream: false,
          options: {
            temperature: 0.7,
            num_predict: 500, // Increased for complete responses
            num_ctx: 2048, // Increased context for better responses
            num_thread: 2, // Optimal for 4-core system
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: config.ollama.timeout, // Use config timeout
          maxContentLength: Infinity, // Allow unlimited response size
          maxBodyLength: Infinity // Allow unlimited response size
        }
      );

      const responseText = response.data.response;
      
      // Add the avatar response to history
      const avatarMessage: ChatMessage = {
        sender: 'avatar',
        text: responseText,
        timestamp: Date.now()
      };
      this.conversationHistory.push(avatarMessage);

      return {
        response: responseText,
        success: true
      };
    } catch (error: any) {
      console.error('Ollama API Error:', error);
      
      // Check if Ollama is not running
      if (error.code === 'ECONNREFUSED' || error.message?.includes('connect')) {
        return {
          response: "I'm sorry, but I can't connect to my local AI service. Please make sure Ollama is installed and running. You can install it from https://ollama.ai and run 'ollama serve' to start the service.",
          success: false,
          error: 'Connection refused'
        };
      }
      
      // Check for timeout
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        return {
          response: "I'm sorry, the AI model is taking longer than expected to respond. This usually happens on the first request as the model loads into memory. Please try again in a moment.",
          success: false,
          error: 'Timeout'
        };
      }
      
      // Check for model loading issues
      if (error.message?.includes('model') || error.message?.includes('not found')) {
        return {
          response: "I'm sorry, the AI model is not available. Please make sure the model is downloaded by running 'ollama pull llama3.2:3b' in your terminal.",
          success: false,
          error: 'Model not found'
        };
      }
      
      return {
        response: "I'm sorry, I'm having trouble processing your request right now. Please try again in a moment.",
        success: false,
        error: error.message
      };
    }
  }

  private async getRelevantKnowledge(userQuery: string): Promise<KnowledgeLink[]> {
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<KnowledgeLink[]>((_, reject) => {
        setTimeout(() => reject(new Error('Knowledge base query timeout')), 5000);
      });
      
      const queryPromise = (async () => {
        // Use the search endpoint for better relevance
        const searchResults = await searchKnowledge(userQuery);
        
        // If search returns results, use them
        if (searchResults.length > 0) {
          return searchResults.slice(0, 3); // Limit to top 3 most relevant sources
        }
        
        // Fallback to client-side filtering if search returns no results
        const allKnowledge = await getAllKnowledge();
        const queryWords = userQuery.toLowerCase().split(/\s+/);
        
        // Simple relevance scoring based on tag matches
        const relevantKnowledge = allKnowledge
          .filter(knowledge => knowledge.status === 'crawled' && knowledge.tags.length > 0)
          .map(knowledge => {
            const matchingTags = knowledge.tags.filter(tag => 
              queryWords.some(word => tag.toLowerCase().includes(word) || word.includes(tag.toLowerCase()))
            );
            const relevanceScore = matchingTags.length;
            return { ...knowledge, relevanceScore };
          })
          .filter(knowledge => knowledge.relevanceScore > 0)
          .sort((a, b) => b.relevanceScore - a.relevanceScore)
          .slice(0, 3); // Limit to top 3 most relevant sources
        
        return relevantKnowledge;
      })();
      
      return await Promise.race([queryPromise, timeoutPromise]);
    } catch (error) {
      console.error('Error fetching relevant knowledge:', error);
      return [];
    }
  }

  private createSystemPrompt(skillLevel: 'beginner' | 'intermediate' | 'advanced', relevantKnowledge: KnowledgeLink[], avatarName: string): string {
    const basePrompt = `You are ${avatarName}, a friendly and knowledgeable Bitcoin education guide. You have expertise in Bitcoin, Lightning Network, and Nostr. You should be encouraging, patient, and always educational. Keep responses conversational and engaging. Always stay in character as ${avatarName}.`;

    // Add knowledge context if available
    let knowledgeContext = '';
    if (relevantKnowledge.length > 0) {
      knowledgeContext = '\n\nRelevant knowledge from your knowledge base:\n';
      relevantKnowledge.forEach((knowledge, index) => {
        knowledgeContext += `${index + 1}. Source: ${knowledge.url}\n`;
        knowledgeContext += `   Tags: ${knowledge.tags.join(', ')}\n`;
        if (knowledge.content) {
          // Clean up content: remove excessive whitespace, newlines, tabs, and duplicates
          const cleanedContent = knowledge.content
            .replace(/[\n\r\t]+/g, ' ') // Replace newlines, tabs with single space
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .trim()
            // Remove consecutive duplicate words/phrases more precisely
            .replace(/\b(\w+)\s+\1\b/g, '$1') // Remove consecutive duplicate words
            .replace(/([^\s]+)\s+\1/g, '$1'); // Remove consecutive duplicate phrases
          
          // Include a preview of the cleaned content (first 200 characters)
          const contentPreview = cleanedContent.substring(0, 200);
          if (contentPreview) {
            knowledgeContext += `   Content: ${contentPreview}${cleanedContent.length > 200 ? '...' : ''}\n`;
          }
        }
        knowledgeContext += '\n';
      });
      knowledgeContext += 'Use this knowledge to provide more accurate and up-to-date information when relevant to the user\'s question.\n';
    }

    const skillPrompts = {
      beginner: `${basePrompt}${knowledgeContext} The user is a beginner. Use simple language, avoid technical jargon, and provide clear explanations. Focus on fundamental concepts like what Bitcoin is, why it matters, and basic security practices. Use analogies and real-world examples. Keep responses under 200 words.`,
      intermediate: `${basePrompt}${knowledgeContext} The user has some knowledge. You can use more technical terms but still explain them. Cover topics like Lightning Network, wallet types, transaction fees, and intermediate security concepts. Provide practical examples. Keep responses under 300 words.`,
      advanced: `${basePrompt}${knowledgeContext} The user is advanced. You can dive deep into technical details, discuss advanced topics like Nostr, Lightning routing, privacy features, and complex Bitcoin concepts. Engage in technical discussions. Keep responses under 400 words.`
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