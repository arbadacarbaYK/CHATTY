const express = require('express');
const router = express.Router();
const sessionService = require('../services/sessionService');
const axios = require('axios');

// Performance monitoring
const performanceMetrics = {
  totalRequests: 0,
  averageResponseTime: 0,
  responseTimes: [],
  knowledgeBaseHits: 0,
  knowledgeBaseMisses: 0
};

// POST /chat/message - Send a message and get AI response
router.post('/message', async (req, res) => {
  const startTime = Date.now();
  performanceMetrics.totalRequests++;
  
  try {
    const { message, skillLevel, avatarName } = req.body;
    const userId = req.session.userId;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get or create user session
    const userSession = await sessionService.getUserSession(userId);
    
    // Update session settings if provided (async, don't wait)
    if (skillLevel || avatarName) {
      sessionService.updateSessionSettings(
        userId, 
        skillLevel || userSession.skill_level, 
        avatarName || userSession.avatar_name
      ).catch(err => {
        console.error('Failed to update session settings:', err);
      });
    }

    // Add user message to conversation history
    const userMessage = {
      sender: 'user',
      text: message,
      timestamp: Date.now()
    };

    const conversationHistory = [...userSession.conversation_history, userMessage];

    // Limit history length (keep last 20 messages for better context)
    if (conversationHistory.length > 20) {
      conversationHistory.splice(0, conversationHistory.length - 20);
    }

    // Create system prompt based on skill level
    const systemPrompt = createSystemPrompt(
      skillLevel || userSession.skill_level, 
      avatarName || userSession.avatar_name
    );

    // Smart conversation context management
    let conversationContext = '';
    const totalMessages = conversationHistory.length;
    
    if (totalMessages <= 2) {
      // For very short conversations, include all messages
      conversationContext = conversationHistory
        .map(msg => `${msg.sender === 'user' ? 'User' : avatarName || userSession.avatar_name}: ${msg.text}`)
        .join('\n');
    } else {
      // SMART CONTEXT COMPRESSION:
      // 1. Last 2 messages (immediate context)
      // 2. Extract key topics from current message
      // 3. Find most relevant previous message (max 1)
      const currentTopic = extractTopic(message);
      const lastMessages = conversationHistory.slice(-2);
      
      // Find the most relevant previous message (if any)
      let mostRelevantMessage = null;
      if (currentTopic && currentTopic.length > 2) {
        const relevantMessages = conversationHistory
          .slice(0, -1) // Exclude current message
          .filter(msg => msg.sender === 'user')
          .filter(msg => {
            const msgLower = msg.text.toLowerCase();
            const topicLower = currentTopic.toLowerCase();
            return msgLower.includes(topicLower) || 
                   topicLower.split(' ').some(word => word.length > 3 && msgLower.includes(word));
          });
        
        if (relevantMessages.length > 0) {
          mostRelevantMessage = relevantMessages[relevantMessages.length - 1]; // Get most recent relevant
        }
      }
      
      // Build compressed context
      const contextMessages = [];
      if (mostRelevantMessage) {
        contextMessages.push(mostRelevantMessage);
      }
      contextMessages.push(...lastMessages);
      
      // Compress messages to key points only
      conversationContext = contextMessages
        .map(msg => {
          const text = msg.text;
          if (text.length > 50) {
            // Compress long messages to key phrases
            const words = text.split(' ');
            const keyWords = words.filter(word => 
              word.length > 3 && 
              !['what', 'when', 'where', 'which', 'about', 'tell', 'explain', 'describe'].includes(word.toLowerCase())
            );
            const compressed = keyWords.slice(0, 8).join(' '); // Max 8 key words
            return `${msg.sender === 'user' ? 'User' : avatarName || userSession.avatar_name}: ${compressed}`;
          }
          return `${msg.sender === 'user' ? 'User' : avatarName || userSession.avatar_name}: ${text}`;
        })
        .join('\n');
    }

    // Search knowledge base for relevant information
    let knowledgeContext = '';
    let knowledgeFound = false;
    let knowledgeResponse = null;
    try {
      console.log('Searching knowledge base for:', message);
      knowledgeResponse = await axios.get(`${process.env.BACKEND_URL || 'http://localhost:3000'}/knowledge/search?q=${encodeURIComponent(message)}`);
      console.log('Knowledge search results:', knowledgeResponse.data);
      if (knowledgeResponse.data.results && knowledgeResponse.data.results.length > 0) {
        const relevantKnowledge = knowledgeResponse.data.results.slice(0, 1); // Top 1 result only
        knowledgeContext = '\n\n' + 
          relevantKnowledge.map(k => `- ${k.content.substring(0, 60)}`).join('\n'); // Limit to 60 chars for speed
        console.log('Knowledge context added:', knowledgeContext);
        knowledgeFound = true;
        performanceMetrics.knowledgeBaseHits++;
              } else {
          performanceMetrics.knowledgeBaseMisses++;
          // Try broader search for specific topics
        if (message.toLowerCase().includes('wallet') || message.toLowerCase().includes('lightning') || 
            message.toLowerCase().includes('nostr') || message.toLowerCase().includes('cashu') || 
            message.toLowerCase().includes('bitcoin') || message.toLowerCase().includes('blixt')) {
          let searchTerm = 'wallet';
          if (message.toLowerCase().includes('blixt')) {
            searchTerm = 'blixt';
          } else if (message.toLowerCase().includes('lightning')) {
            searchTerm = 'lightning';
          } else if (message.toLowerCase().includes('nostr')) {
            searchTerm = 'nostr';
          } else if (message.toLowerCase().includes('cashu')) {
            searchTerm = 'cashu';
          } else if (message.toLowerCase().includes('bitcoin')) {
            searchTerm = 'bitcoin';
          }
          const broaderResponse = await axios.get(`${process.env.BACKEND_URL || 'http://localhost:3000'}/knowledge/search?q=${searchTerm}`);
          if (broaderResponse.data.results && broaderResponse.data.results.length > 0) {
            const broaderKnowledge = broaderResponse.data.results.slice(0, 1);
            knowledgeContext = '\n\n' + 
              broaderKnowledge.map(k => `- ${k.content.substring(0, 60)}`).join('\n');
            console.log('Broader knowledge context added:', knowledgeContext);
            knowledgeFound = true;
            knowledgeResponse = broaderResponse; // Set the response for knowledge sources
            performanceMetrics.knowledgeBaseHits++;
          }
        }
      }
    } catch (error) {
      console.error('Knowledge base search error:', error);
      performanceMetrics.knowledgeBaseMisses++;
    }

    // Create the full prompt for Ollama - OPTIMIZED FOR SPEED
    const fullPrompt = `${systemPrompt}

${knowledgeContext ? `KNOWLEDGE:${knowledgeContext}` : ''}

${conversationContext}

${avatarName || userSession.avatar_name}:`;

    // Send to Ollama with ULTRA-OPTIMIZED settings for speed
    const ollamaResponse = await axios.post(`${process.env.OLLAMA_URL || 'http://localhost:11434'}/api/generate`, {
      model: process.env.OLLAMA_MODEL || 'llama3.2:1b',
      prompt: fullPrompt,
      stream: false,
      options: {
        num_predict: 24,         // Ultra-minimal for speed
        temperature: 0.2,        // Very low for fastest generation
        top_p: 0.4,             // Very low for fastest sampling
        repeat_penalty: 1.0,     // No penalty for speed
        top_k: 3,               // Ultra-minimal for speed
        num_ctx: 128,           // Ultra-minimal context for speed
        num_thread: 8           // More threads for speed
      }
    }, {
      timeout: 60000 // Set to 60 seconds - optimized for ~45 second Ollama response
    });

    let aiResponse = ollamaResponse.data.response;
    let webSearchResults = null;

    // Check if AI wants to perform a web search (only for specific queries that need current info)
    const webSearchMatch = aiResponse.match(/WEB_SEARCH:\s*(.+?)(?:\n|$)/);
    if (webSearchMatch) {
      const searchQuery = webSearchMatch[1].trim();
      console.log('AI requested web search for:', searchQuery);
      
      // Only do web search for specific current topics, not general questions
      const currentTopics = ['latest', 'recent', 'new', 'update', 'development', '2024', '2023'];
      const needsCurrentInfo = currentTopics.some(topic => searchQuery.toLowerCase().includes(topic));
      
      if (needsCurrentInfo) {
        try {
          // Perform web search with timeout
          const webSearchResponse = await axios.get(`${process.env.BACKEND_URL || 'http://localhost:3000'}/chat/web-search?query=${encodeURIComponent(searchQuery)}`, {
            timeout: 3000 // 3 second timeout
          });
          if (webSearchResponse.data.success && webSearchResponse.data.results.length > 0) {
            webSearchResults = webSearchResponse.data.results;
            
            // Remove the WEB_SEARCH directive and add web search results to response
            aiResponse = aiResponse.replace(/WEB_SEARCH:\s*.+?(?:\n|$)/, '');
            aiResponse += `\n\n🌐 **Web Search Results for "${searchQuery}":**\n\n`;
            webSearchResults.forEach((result, index) => {
              aiResponse += `${index + 1}. **${result.title}**\n   ${result.content}\n   Source: ${result.source}\n   URL: ${result.url}\n\n`;
            });
          }
        } catch (error) {
          console.error('Web search failed:', error);
          // Remove the WEB_SEARCH directive if search failed
          aiResponse = aiResponse.replace(/WEB_SEARCH:\s*.+?(?:\n|$)/, '');
        }
      } else {
        // Remove WEB_SEARCH directive for non-current topics
        aiResponse = aiResponse.replace(/WEB_SEARCH:\s*.+?(?:\n|$)/, '');
      }
    }

    // Add AI response to conversation history
    const aiMessage = {
      sender: 'avatar',
      text: aiResponse,
      timestamp: Date.now(),
      webSearchResults: webSearchResults
    };

    conversationHistory.push(aiMessage);

    // Update conversation history in database (async, don't wait)
    sessionService.updateConversationHistory(userId, conversationHistory).catch(err => {
      console.error('Failed to update conversation history:', err);
    });

    // Update performance metrics
    const responseTime = Date.now() - startTime;
    performanceMetrics.responseTimes.push(responseTime);
    if (performanceMetrics.responseTimes.length > 100) {
      performanceMetrics.responseTimes.shift(); // Keep only last 100
    }
    performanceMetrics.averageResponseTime = performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) / performanceMetrics.responseTimes.length;

    // Get knowledge base sources for context
    let knowledgeSources = [];
    if (knowledgeFound && knowledgeResponse && knowledgeResponse.data.results) {
      knowledgeSources = knowledgeResponse.data.results.slice(0, 3).map(k => ({
        url: k.url,
        title: k.title || 'Knowledge Base Entry',
        content: k.content.substring(0, 100) + '...'
      }));
    } else if (knowledgeFound) {
      // Fallback: search again to get the results
      try {
        const fallbackResponse = await axios.get(`${process.env.BACKEND_URL || 'http://localhost:3000'}/knowledge/search?q=${encodeURIComponent(message)}`);
        if (fallbackResponse.data.results && fallbackResponse.data.results.length > 0) {
          knowledgeSources = fallbackResponse.data.results.slice(0, 3).map(k => ({
            url: k.url,
            title: k.title || 'Knowledge Base Entry',
            content: k.content.substring(0, 100) + '...'
          }));
        }
      } catch (error) {
        console.error('Fallback knowledge search failed:', error);
      }
    }

    res.json({
      success: true,
      response: aiResponse,
      conversationHistory: conversationHistory,
      knowledgeSources: knowledgeSources,
      performance: {
        responseTime,
        knowledgeFound,
        averageResponseTime: Math.round(performanceMetrics.averageResponseTime)
      }
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to process message' 
    });
  }
});

// GET /chat/history - Get conversation history for current user
router.get('/history', async (req, res) => {
  try {
    const userId = req.session.userId;
    const userSession = await sessionService.getUserSession(userId);
    
    res.json({
      success: true,
      conversationHistory: userSession.conversation_history,
      skillLevel: userSession.skill_level,
      avatarName: userSession.avatar_name
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get conversation history' 
    });
  }
});

// POST /chat/clear - Clear conversation history for current user
router.post('/clear', async (req, res) => {
  try {
    const userId = req.session.userId;
    await sessionService.clearConversationHistory(userId);
    
    res.json({
      success: true,
      message: 'Conversation history cleared'
    });
  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to clear conversation history' 
    });
  }
});

// GET /chat/session-info - Get current session information
router.get('/session-info', async (req, res) => {
  try {
    const userId = req.session.userId;
    const userSession = await sessionService.getUserSession(userId);
    const stats = await sessionService.getSessionStats();
    
    res.json({
      success: true,
      session: {
        userId: userSession.user_id,
        sessionId: userSession.session_id,
        skillLevel: userSession.skill_level,
        avatarName: userSession.avatar_name,
        createdAt: userSession.created_at,
        updatedAt: userSession.updated_at,
        messageCount: userSession.conversation_history.length
      },
      stats: {
        totalSessions: stats.total_sessions,
        activeSessions: stats.active_sessions
      }
    });
  } catch (error) {
    console.error('Session info error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get session information' 
    });
  }
});

// GET /chat/performance - Get performance metrics
router.get('/performance', async (req, res) => {
  try {
    res.json({
      success: true,
      metrics: performanceMetrics
    });
  } catch (error) {
    console.error('Performance metrics error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get performance metrics' 
    });
  }
});

// Extract topic from user message for context management
function extractTopic(message) {
  const topics = [
    'blixt', 'phoenix', 'wallet', 'lightning', 'nostr', 'cashu', 'bitcoin', 
    'electrum', 'lnbits', 'btcpay', 'mempool', 'fees', 'privacy', 'security',
    'multisig', 'hardware', 'software', 'mobile', 'desktop', 'web'
  ];
  
  const lowerMessage = message.toLowerCase();
  for (const topic of topics) {
    if (lowerMessage.includes(topic)) {
      return topic;
    }
  }
  
  // If no specific topic found, return a general term
  return 'bitcoin';
}

// Create system prompt based on skill level - ULTRA-OPTIMIZED
function createSystemPrompt(skillLevel, avatarName) {
  const basePrompt = `You are ${avatarName}, a Bitcoin education guide.`;

  const skillPrompts = {
    beginner: `${basePrompt} Teach beginners with simple language. Keep responses concise (2-3 sentences). Focus on basic Bitcoin, Lightning, Cashu, and Nostr concepts.`,
    
    intermediate: `${basePrompt} Teach users with some Bitcoin knowledge. Use moderate technical language. Provide detailed explanations (4-6 sentences).`,
    
    advanced: `${basePrompt} Teach advanced users with technical language. Provide comprehensive explanations (6-8 sentences).`
  };

  // Avatar-specific prompts for specialists - COMPRESSED
  const avatarPrompts = {
    'Satoshi': `${basePrompt} Bitcoin generalist. Provide broad overviews of Bitcoin, Lightning, Cashu, Nostr. Keep responses accessible and encouraging.`,
    
    'Lightning': `${basePrompt} Lightning Network specialist. Focus on Lightning protocol, payment channels, routing, and tools.`,
    
    'Nostr': `${basePrompt} Nostr protocol specialist. Focus on Nostr protocol, relays, clients, and decentralized social media.`,
    
    'Cashu': `${basePrompt} Cashu protocol specialist. Focus on Cashu protocol, ecash, privacy features, and applications.`
  };

  // Use avatar-specific prompt if available, otherwise use skill-based prompt
  if (avatarPrompts[avatarName]) {
    return avatarPrompts[avatarName];
  }
  return skillPrompts[skillLevel] || skillPrompts.beginner;
}

// GET /chat/health - Check Ollama health
router.get('/health', async (req, res) => {
  try {
    const healthResponse = await axios.get(`${process.env.OLLAMA_URL || 'http://localhost:11434'}/api/tags`, {
      timeout: 5000
    });

    const models = healthResponse.data.models || [];
    const ourModel = models.find((m) => m.name === (process.env.OLLAMA_MODEL || 'llama3.2:1b'));
    
    res.json({
      isRunning: true,
      modelAvailable: !!ourModel,
      modelName: process.env.OLLAMA_MODEL || 'llama3.2:1b',
      error: null
    });
  } catch (error) {
    console.error('Ollama health check failed:', error);
    res.json({
      isRunning: false,
      modelAvailable: false,
      modelName: process.env.OLLAMA_MODEL || 'llama3.2:1b',
      error: error.message
    });
  }
});

// GET /chat/web-search - Search the web for additional information
router.get('/web-search', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Use SearXNG for privacy-focused web search (fallback to curated resources if API fails)
    let results = [];
    
    try {
      const searchResponse = await axios.get('https://searx.be/search', {
        params: {
          q: `${query} bitcoin`,
          format: 'json',
          engines: 'google,bing',
          categories: 'general',
          language: 'en',
          time_range: 'year',
          safesearch: '0'
        },
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BitcoinEduBot/1.0)'
        }
      });

      if (searchResponse.data?.results) {
        results = searchResponse.data.results.slice(0, 3).map(result => ({
          title: result.title || 'Web Result',
          url: result.url || '',
          content: result.content || 'No description available',
          source: 'SearXNG'
        }));
      }
    } catch (error) {
      console.log('SearXNG failed, using curated resources');
    }

    // Fallback to curated Bitcoin resources if web search fails
    if (results.length === 0) {
      const bitcoinResources = {
        'hardware wallet': [
          {
            title: 'Bitcoin Hardware Wallets Guide',
            url: 'https://bitcoin.org/en/choose-your-wallet',
            content: 'Official Bitcoin.org guide to choosing a hardware wallet. Hardware wallets are physical devices that store your private keys offline.',
            source: 'Bitcoin.org'
          }
        ],
        'lightning network': [
          {
            title: 'Lightning Network Documentation',
            url: 'https://lightning.network/',
            content: 'The Lightning Network is a second-layer payment protocol that enables instant, low-cost Bitcoin transactions.',
            source: 'Lightning Labs'
          }
        ],
        'nostr': [
          {
            title: 'Nostr Protocol',
            url: 'https://github.com/nostr-protocol/nostr',
            content: 'Nostr is a simple, open protocol that enables global, decentralized, and censorship-resistant social media.',
            source: 'Nostr Protocol'
          }
        ],
        'cashu': [
          {
            title: 'Cashu Protocol',
            url: 'https://github.com/cashubtc/cashu',
            content: 'Cashu is a protocol for creating and using ecash tokens on Bitcoin Lightning Network.',
            source: 'Cashu Protocol'
          }
        ]
      };

      const queryLower = query.toLowerCase();
      for (const [key, resources] of Object.entries(bitcoinResources)) {
        if (queryLower.includes(key) || key.includes(queryLower)) {
          results = resources;
          break;
        }
      }

      // Default resources if no specific match
      if (results.length === 0) {
        results = [{
          title: 'Bitcoin.org',
          url: 'https://bitcoin.org/',
          content: 'The official Bitcoin website with comprehensive information about Bitcoin, wallets, and getting started.',
          source: 'Bitcoin.org'
        }];
      }
    }

    res.json({
      success: true,
      query: query,
      results: results.slice(0, 2),
      totalResults: results.length
    });

  } catch (error) {
    console.error('Web search error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Web search temporarily unavailable' 
    });
  }
});

module.exports = router; 