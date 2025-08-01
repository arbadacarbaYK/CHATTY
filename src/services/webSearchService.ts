import axios from 'axios';

export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
  source: string;
}

export interface WebSearchResponse {
  success: boolean;
  query: string;
  results: WebSearchResult[];
  totalResults: number;
  error?: string;
}

export class WebSearchService {
  private static instance: WebSearchService;

  private constructor() {}

  public static getInstance(): WebSearchService {
    if (!WebSearchService.instance) {
      WebSearchService.instance = new WebSearchService();
    }
    return WebSearchService.instance;
  }

  public async searchWeb(query: string): Promise<WebSearchResponse> {
    try {
      const response = await axios.get('/chat/web-search', {
        params: { query },
        timeout: 15000
      });

      return response.data;
    } catch (error: any) {
      console.error('Web search failed:', error);
      return {
        success: false,
        query,
        results: [],
        totalResults: 0,
        error: error.response?.data?.error || error.message || 'Web search failed'
      };
    }
  }

  public async searchBitcoinTopics(topic: string): Promise<WebSearchResponse> {
    // Simple Bitcoin-focused search
    const bitcoinQuery = `${topic} bitcoin`;
    return this.searchWeb(bitcoinQuery);
  }
} 