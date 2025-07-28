import { config } from '../config/appConfig';
import { ChatService } from './chatService';
import { getAllKnowledge } from './knowledgeService';

export interface ServiceStatus {
  ollama: {
    isRunning: boolean;
    modelAvailable: boolean;
    lastCheck: number;
    error?: string;
  };
  backend: {
    isRunning: boolean;
    lastCheck: number;
    error?: string;
  };
  frontend: {
    isRunning: boolean;
    lastCheck: number;
    error?: string;
  };
}

export interface ConnectionEvent {
  type: 'connected' | 'disconnected' | 'reconnected' | 'error';
  service: 'ollama' | 'backend' | 'frontend';
  timestamp: number;
  error?: string;
}

export class ConnectionMonitor {
  private static instance: ConnectionMonitor;
  private status: ServiceStatus = {
    ollama: { isRunning: false, modelAvailable: false, lastCheck: 0 },
    backend: { isRunning: false, lastCheck: 0 },
    frontend: { isRunning: true, lastCheck: Date.now() }
  };
  
  private isMonitoring = false;
  private eventListeners: ((event: ConnectionEvent) => void)[] = [];
  private checkInterval: number | null = null;

  private constructor() {}

  public static getInstance(): ConnectionMonitor {
    if (!ConnectionMonitor.instance) {
      ConnectionMonitor.instance = new ConnectionMonitor();
    }
    return ConnectionMonitor.instance;
  }

  public startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log('Starting connection monitoring...');
    
    // Initial health check
    this.performHealthCheck();
    
    // Set up periodic health checks
    this.checkInterval = setInterval(() => {
      this.performHealthCheck();
    }, config.chat.healthCheckInterval);
  }

  public stopMonitoring(): void {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    console.log('Stopping connection monitoring...');
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  public getStatus(): ServiceStatus {
    return { ...this.status };
  }

  public addEventListener(listener: (event: ConnectionEvent) => void): void {
    this.eventListeners.push(listener);
  }

  public removeEventListener(listener: (event: ConnectionEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  private emitEvent(event: ConnectionEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in connection event listener:', error);
      }
    });
  }

  private async performHealthCheck(): Promise<void> {
    const now = Date.now();
    
    // Check Ollama
    await this.checkOllamaHealth(now);
    
    // Check Backend
    await this.checkBackendHealth(now);
    
    // Check Frontend (always true since we're running)
    this.status.frontend.isRunning = true;
    this.status.frontend.lastCheck = now;
  }

  private async checkOllamaHealth(timestamp: number): Promise<void> {
    const previousStatus = this.status.ollama.isRunning;
    
    try {
      const chatService = ChatService.getInstance();
      const health = await chatService.checkHealth();
      
      this.status.ollama.isRunning = health.isRunning;
      this.status.ollama.modelAvailable = health.modelAvailable;
      this.status.ollama.lastCheck = timestamp;
      this.status.ollama.error = health.error;
      
      // Emit events for status changes
      if (!previousStatus && health.isRunning) {
        this.emitEvent({
          type: 'connected',
          service: 'ollama',
          timestamp,
        });
      } else if (previousStatus && !health.isRunning) {
        this.emitEvent({
          type: 'disconnected',
          service: 'ollama',
          timestamp,
          error: health.error,
        });
      } else if (!previousStatus && !health.isRunning && this.status.ollama.lastCheck > 0) {
        // This is a reconnection attempt
        this.emitEvent({
          type: 'reconnected',
          service: 'ollama',
          timestamp,
        });
      }
    } catch (error: any) {
      this.status.ollama.isRunning = false;
      this.status.ollama.modelAvailable = false;
      this.status.ollama.lastCheck = timestamp;
      this.status.ollama.error = error.message;
      
      if (previousStatus) {
        this.emitEvent({
          type: 'disconnected',
          service: 'ollama',
          timestamp,
          error: error.message,
        });
      }
    }
  }

  private async checkBackendHealth(timestamp: number): Promise<void> {
    const previousStatus = this.status.backend.isRunning;
    
    try {
      // Try to fetch knowledge to test backend
      await getAllKnowledge();
      
      this.status.backend.isRunning = true;
      this.status.backend.lastCheck = timestamp;
      this.status.backend.error = undefined;
      
      // Emit events for status changes
      if (!previousStatus) {
        this.emitEvent({
          type: 'connected',
          service: 'backend',
          timestamp,
        });
      }
    } catch (error: any) {
      this.status.backend.isRunning = false;
      this.status.backend.lastCheck = timestamp;
      this.status.backend.error = error.message;
      
      if (previousStatus) {
        this.emitEvent({
          type: 'disconnected',
          service: 'backend',
          timestamp,
          error: error.message,
        });
      }
    }
  }

  public async forceReconnect(): Promise<void> {
    console.log('Forcing reconnection...');
    
    // Stop current monitoring
    this.stopMonitoring();
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Restart monitoring
    this.startMonitoring();
  }

  public isAllServicesHealthy(): boolean {
    return this.status.ollama.isRunning && 
           this.status.backend.isRunning && 
           this.status.frontend.isRunning;
  }

  public getConnectionSummary(): string {
    const issues: string[] = [];
    
    if (!this.status.ollama.isRunning) {
      issues.push('AI Model (Ollama)');
    }
    if (!this.status.backend.isRunning) {
      issues.push('Knowledge Base (Backend)');
    }
    if (!this.status.frontend.isRunning) {
      issues.push('Frontend');
    }
    
    if (issues.length === 0) {
      return 'All services connected';
    } else {
      return `Connection issues: ${issues.join(', ')}`;
    }
  }
} 