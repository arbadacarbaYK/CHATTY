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
    // Dev: Vite proxies /api → Ollama. Preview/prod: hit local Ollama /api directly.
    url: import.meta.env.DEV ? '/api' : 'http://127.0.0.1:11434/api',
    model: 'llama3.2:3b',
    timeout: 300000,
  },
  avatar: {
    defaultModel: 'kei',
    fallbackEnabled: true,
  },
  chat: {
    maxHistoryLength: 20,
    healthCheckInterval: 30000,
  },
  ui: {
    mobileBreakpoint: 768,
    maxMessageLength: 1000,
  },
};

// Environment-based configuration
export const getConfig = (): AppConfig => {
  const isDev = import.meta.env.DEV;

  let ollamaUrl = import.meta.env.VITE_OLLAMA_URL;
  if (!ollamaUrl) {
    ollamaUrl = isDev ? '/api' : 'http://127.0.0.1:11434/api';
  }

  return {
    ollama: {
      url: ollamaUrl,
      model: import.meta.env.VITE_OLLAMA_MODEL || defaultConfig.ollama.model,
      timeout: parseInt(
        import.meta.env.VITE_OLLAMA_TIMEOUT || defaultConfig.ollama.timeout.toString()
      ),
    },
    avatar: {
      defaultModel: import.meta.env.VITE_AVATAR_MODEL || defaultConfig.avatar.defaultModel,
      fallbackEnabled: import.meta.env.VITE_AVATAR_FALLBACK !== 'false',
    },
    chat: {
      maxHistoryLength: parseInt(
        import.meta.env.VITE_CHAT_MAX_HISTORY ||
          defaultConfig.chat.maxHistoryLength.toString()
      ),
      healthCheckInterval: parseInt(
        import.meta.env.VITE_HEALTH_CHECK_INTERVAL ||
          defaultConfig.chat.healthCheckInterval.toString()
      ),
    },
    ui: {
      mobileBreakpoint: parseInt(
        import.meta.env.VITE_MOBILE_BREAKPOINT ||
          defaultConfig.ui.mobileBreakpoint.toString()
      ),
      maxMessageLength: parseInt(
        import.meta.env.VITE_MAX_MESSAGE_LENGTH ||
          defaultConfig.ui.maxMessageLength.toString()
      ),
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