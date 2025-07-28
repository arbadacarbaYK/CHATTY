// Application configuration
export interface AppConfig {
  ollama: {
    url: string;
    model: string;
    timeout: number;
  };
  avatar: {
    defaultModel: string;
    fallbackEnabled: boolean;
  };
  chat: {
    maxHistoryLength: number;
    healthCheckInterval: number;
  };
  ui: {
    mobileBreakpoint: number;
    maxMessageLength: number;
  };
}

// Default configuration
export const defaultConfig: AppConfig = {
  ollama: {
    url: import.meta.env.DEV ? '/api' : 'http://localhost:11434', // Use proxy in dev, direct URL in prod
    model: 'llama3.2:3b', // Llama 3.2 3B - faster on 4-core systems
    timeout: 120000, // 2 minutes - increased timeout for model loading and generation
  },
  avatar: {
    defaultModel: 'kei',
    fallbackEnabled: true,
  },
  chat: {
    maxHistoryLength: 20,
    healthCheckInterval: 30000, // 30 seconds
  },
  ui: {
    mobileBreakpoint: 768,
    maxMessageLength: 1000,
  },
};

// Environment-based configuration
export const getConfig = (): AppConfig => {
  // Determine if we're in development or production
  const isDev = import.meta.env.DEV;
  
  // Get Ollama URL with proper fallbacks
  let ollamaUrl = import.meta.env.VITE_OLLAMA_URL;
  if (!ollamaUrl) {
    if (isDev) {
      ollamaUrl = '/api'; // Use Vite proxy in development
    } else {
      ollamaUrl = 'http://localhost:11434'; // Default for production
    }
  }

  // Get backend URL with proper fallbacks
  let backendUrl = import.meta.env.VITE_BACKEND_URL;
  if (!backendUrl) {
    if (isDev) {
      backendUrl = '/knowledge'; // Use Vite proxy in development
    } else {
      backendUrl = 'http://localhost:3000'; // Default for production
    }
  }

  return {
    ollama: {
      url: ollamaUrl,
      model: import.meta.env.VITE_OLLAMA_MODEL || defaultConfig.ollama.model,
      timeout: parseInt(import.meta.env.VITE_OLLAMA_TIMEOUT || defaultConfig.ollama.timeout.toString()),
    },
    avatar: {
      defaultModel: import.meta.env.VITE_AVATAR_MODEL || defaultConfig.avatar.defaultModel,
      fallbackEnabled: import.meta.env.VITE_AVATAR_FALLBACK !== 'false',
    },
    chat: {
      maxHistoryLength: parseInt(import.meta.env.VITE_CHAT_MAX_HISTORY || defaultConfig.chat.maxHistoryLength.toString()),
      healthCheckInterval: parseInt(import.meta.env.VITE_HEALTH_CHECK_INTERVAL || defaultConfig.chat.healthCheckInterval.toString()),
    },
    ui: {
      mobileBreakpoint: parseInt(import.meta.env.VITE_MOBILE_BREAKPOINT || defaultConfig.ui.mobileBreakpoint.toString()),
      maxMessageLength: parseInt(import.meta.env.VITE_MAX_MESSAGE_LENGTH || defaultConfig.ui.maxMessageLength.toString()),
    },
  };
};

// Configuration validation
export const validateConfig = (config: AppConfig): string[] => {
  const errors: string[] = [];

  if (!config.ollama.url) {
    errors.push('Ollama URL is required');
  }

  if (!config.ollama.model) {
    errors.push('Ollama model is required');
  }

  if (config.ollama.timeout < 1000) {
    errors.push('Ollama timeout must be at least 1000ms');
  }

  if (config.chat.maxHistoryLength < 1) {
    errors.push('Chat max history length must be at least 1');
  }

  return errors;
};

// Get current configuration
export const config = getConfig(); 