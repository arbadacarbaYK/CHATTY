import type React from "react"

import { useState, useEffect, useRef } from "react"
import { ChatService } from "../services/chatService"
import { ConnectionMonitor, type ConnectionEvent } from "../services/connectionMonitor"
import { config } from "../config/appConfig"

interface Message {
  sender: "user" | "avatar"
  text: string
  timestamp: number
}

interface OllamaHealth {
  isRunning: boolean
  modelAvailable: boolean
  modelName: string
  error?: string
}

interface ChatUIProps {
  skillLevel: "beginner" | "intermediate" | "advanced"
  onReact?: () => void
  setAvatarState?: (state: 'idle' | 'thinking' | 'speaking') => void;
  avatarName?: string; // Add avatar name prop
}

export const ChatUI: React.FC<ChatUIProps> = ({ skillLevel, onReact, setAvatarState, avatarName = "Satoshe" }) => {
  const [messages, setMessages] = useState<Message[]>([
    { 
      sender: "avatar",
      text: `Hello! I'm ${avatarName}, your Bitcoin education guide. I'll be teaching you at the ${skillLevel} level. Ask me anything about Bitcoin, Lightning Network, Cashu, or Nostr!`,
      timestamp: Date.now(),
    },
  ])
  const [inputText, setInputText] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [healthStatus, setHealthStatus] = useState<OllamaHealth>({
    isRunning: false,
    modelAvailable: false,
    modelName: config.ollama.model,
  })
  const [showHealthStatus, setShowHealthStatus] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  // Add new state for modes
  const [micMode, setMicMode] = useState(false);
  const [audioMode, setAudioMode] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  // Add missing state for micPermission and speechSupported
  const [micPermission, setMicPermission] = useState<boolean | null>(null);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);

  const [ollamaReady, setOllamaReady] = useState(false);
  const [ollamaLoading, setOllamaLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<string>('Checking connections...');
  const [showConnectionAlert, setShowConnectionAlert] = useState(false);

  const recognitionRef = useRef<any>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const micModeRef = useRef<boolean>(false)

  const chatService = ChatService.getInstance()

  useEffect(() => {
    setOllamaLoading(true);
    
    // Start connection monitoring
    const connectionMonitor = ConnectionMonitor.getInstance();
    connectionMonitor.startMonitoring();
    
    // Set up connection event listeners
    const handleConnectionEvent = (event: ConnectionEvent) => {
      console.log('Connection event:', event);
      
      if (event.type === 'disconnected') {
        setShowConnectionAlert(true);
        setConnectionStatus(`Connection lost: ${event.service}`);
      } else if (event.type === 'connected' || event.type === 'reconnected') {
        setShowConnectionAlert(false);
        setConnectionStatus('All services connected');
      }
    };
    
    connectionMonitor.addEventListener(handleConnectionEvent);
    
    // Initial health check
    chatService.checkHealth().then((health) => {
      setHealthStatus(health);
      setOllamaReady(health.isRunning && health.modelAvailable);
      setOllamaLoading(false);
      
      // Update connection status
      const status = connectionMonitor.getStatus();
      if (status.ollama.isRunning && status.backend.isRunning) {
        setConnectionStatus('All services connected');
      } else {
        setConnectionStatus(connectionMonitor.getConnectionSummary());
        setShowConnectionAlert(true);
      }
    });
    
    checkMicPermission()
    initializeSpeech()

    return () => {
      connectionMonitor.removeEventListener(handleConnectionEvent);
      connectionMonitor.stopMonitoring();
    }
  }, [])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Update avatar state based on isLoading and isSpeaking
  useEffect(() => {
    if (isSpeaking) {
      setAvatarState && setAvatarState('speaking');
    } else if (isLoading) {
      setAvatarState && setAvatarState('thinking');
      } else {
      setAvatarState && setAvatarState('idle');
    }
  }, [isLoading, isSpeaking, setAvatarState]);

  const initializeSpeech = () => {
    if (typeof window !== "undefined") {
      // Check for speech recognition support
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

      if (SpeechRecognition) {
        setSpeechSupported(true)
        recognitionRef.current = new SpeechRecognition()
        recognitionRef.current.continuous = false; // Change to false - stop after each speech
      recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = "en-US";
      
      recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[event.results.length - 1][0].transcript;
          console.log("Speech detected:", transcript);
          setInputText("");
          // In mic mode, send as chat message immediately
          if (micModeRef.current) {
            console.log("Sending transcript to chat:", transcript);
            handleSend(transcript);
            // Stop listening after sending
            setIsListening(false);
            setMicMode(false);
            micModeRef.current = false;
          } else {
        setInputText(transcript);
            setIsListening(false);
          }
      };
      
      recognitionRef.current.onerror = (event: any) => {
        setIsListening(false);
          setMicError("Speech recognition error: " + event.error);
          setMicMode(false);
      };
      
      recognitionRef.current.onend = () => {
        console.log("Speech recognition ended");
        // Always stop listening when recognition ends
        setIsListening(false);
        // Don't restart automatically - user needs to click mic button again
        };
      }

      // Speech Synthesis (TTS) detection
      if (window.speechSynthesis) {
        synthRef.current = window.speechSynthesis;
        let voicesChecked = false;
        let pollCount = 0;
        const maxPolls = 20; // 2 seconds
        const pollVoices = () => {
          const voices = window.speechSynthesis.getVoices();
          if (voices && voices.length > 0) {
            setTtsSupported(true);
            setTtsError(null);
            voicesChecked = true;
          } else if (pollCount < maxPolls) {
            pollCount++;
            setTimeout(pollVoices, 100);
          } else {
            setTtsSupported(false);
            // Detect Linux for tailored error message
            const isLinux = navigator.userAgent.toLowerCase().includes('linux');
            if (isLinux) {
              setTtsError('No TTS voices found. This is a limitation of Chrome/Brave/Firefox on Linux: browsers do not expose system voices to web apps. For natural voices, use Windows, macOS, iOS, Android, or a commercial TTS API.');
            } else {
              setTtsError('No TTS voices found. Your browser does not provide any voices for text-to-speech.');
            }
          }
        };
        pollVoices();
        window.speechSynthesis.onvoiceschanged = pollVoices;
      } else {
        setTtsSupported(false);
        setTtsError('Speech synthesis is not available in this browser.');
      }
    }
  }

  const checkHealth = async () => {
    const health = await chatService.checkHealth()
    setHealthStatus(health)
  }

  const checkMicPermission = async () => {
    try {
      if ("mediaDevices" in navigator && "getUserMedia" in navigator.mediaDevices) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((track) => track.stop())
        setMicPermission(true)
        setMicError(null);
      } else {
        setMicPermission(false)
        setMicError("Microphone not supported in this browser.");
      }
    } catch (error) {
      setMicPermission(false)
      setMicError("Microphone permission denied or unavailable.");
    }
  }

  const speakText = (text: string) => {
    if (!synthRef.current || (!audioMode && !micMode)) return

    // Cancel any ongoing speech
    synthRef.current.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.9
    utterance.pitch = 1
    utterance.volume = 0.8
    utterance.lang = "en-US"
    
    // Try to use a good voice
    const voices = synthRef.current.getVoices()
    const preferredVoice = voices.find(
      (voice) => voice.lang.includes("en") && (voice.name.includes("Google") || voice.name.includes("Microsoft")),
    )
    if (preferredVoice) {
      utterance.voice = preferredVoice
    }
    
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    synthRef.current.speak(utterance)
  }

  const toggleListening = () => {
    if (!recognitionRef.current) return

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
      } else {
      recognitionRef.current.start()
      setIsListening(true)
    }
  }

  const toggleVoice = () => {
    // setVoiceEnabled(!voiceEnabled) // Removed as per edit hint
    if (isSpeaking && synthRef.current) {
      synthRef.current.cancel()
      setIsSpeaking(false)
    }
  }

  const handleSend = async (text: string) => {
    if (!text.trim()) return

    if (text.length > config.ui.maxMessageLength) {
      alert(`Message too long. Maximum ${config.ui.maxMessageLength} characters allowed.`)
      return
    }

    if (!ollamaReady) {
      setMessages((prev) => [...prev, {
        sender: "avatar",
        text: "AI is still loading. Please wait a moment and try again.",
        timestamp: Date.now(),
      }]);
      setIsLoading(false);
      return;
    }

    const userMessage: Message = { 
      sender: "user",
      text,
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, userMessage])
    setInputText("")
    setIsLoading(true)
    if (onReact) onReact()

    try {
      console.log('Sending message to chat service...');
      const response = await chatService.sendMessage(text, skillLevel, avatarName)
      console.log('Chat service response received:', response.response);
      
      // Check if this was a timeout error
      if (!response.success) {
        let errorMessage = "I'm sorry, there was an error processing your request. Please try again.";
        
        if (response.error?.includes('timeout') || response.error?.includes('ECONNABORTED')) {
          errorMessage = "I'm sorry, the AI model is taking longer than expected to respond. Please try again in a moment.";
        } else if (response.error?.includes('Network Error') || response.error?.includes('Failed to fetch')) {
          errorMessage = "I'm sorry, there seems to be a connection issue. Please check if all services are running and try again.";
        }
        
        const errorResponse: Message = {
          sender: "avatar",
          text: errorMessage,
          timestamp: Date.now(),
        }
        setMessages((prev) => [...prev, errorResponse])
        return;
      }
      
      const avatarResponse: Message = {
        sender: "avatar",
        text: response.response,
        timestamp: Date.now(),
      }
      
      console.log('Adding message to state...');
      setMessages((prev) => [...prev, avatarResponse])
      console.log('Message added to state');
      
      if (onReact) onReact()

      // Auto-speak AI response if voice is enabled
      if (audioMode || micMode) {
        console.log('Speaking text...');
        speakText(response.response)
      } else {
        console.log('Voice disabled, not speaking');
      }
    } catch (error) {
      console.error("Error sending message:", error)
      const errorMessage: Message = {
        sender: "avatar",
        text: "Sorry, I encountered an error. Please check if Ollama is running and try again.",
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSend(inputText)
  }

  const clearChat = () => {
    setMessages([
      {
        sender: "avatar",
        text: `Hello! I'm ${avatarName}, your Bitcoin education guide. I'll be teaching you at the ${skillLevel} level. Ask me anything about Bitcoin, Lightning Network, or Nostr!`,
        timestamp: Date.now(),
      },
    ])
    chatService.clearHistory()
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getHealthStatusColor = () => {
    if (healthStatus.isRunning && healthStatus.modelAvailable) {
      return "text-green-400"
    } else if (healthStatus.isRunning) {
      return "text-yellow-400"
    } else {
      return "text-red-400"
    }
  }

  const getHealthStatusText = () => {
    if (healthStatus.isRunning && healthStatus.modelAvailable) {
      return "AI Ready"
    } else if (healthStatus.isRunning) {
      return "Model Missing"
    } else {
      return "AI Offline"
    }
  }

  // Toggle logic for mic/audio modes
  const handleToggleMicMode = async () => {
    console.log("handleToggleMicMode called, current micMode:", micMode);
    console.log("recognitionRef.current:", recognitionRef.current);
    
    if (micMode) {
      // Turn off mic mode
      console.log("Turning off mic mode");
      setMicMode(false);
      micModeRef.current = false;
      setIsListening(false);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error("Error stopping recognition:", e);
        }
      }
    } else {
      // Turn on mic mode
      console.log("Turning on mic mode");
      try {
        // Always request permission on activation
        await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("Microphone permission granted");
        setMicPermission(true);
        setMicError(null);
        
        // Set modes
      setAudioMode(false);
      setMicMode(true);
        micModeRef.current = true;
      setMicError(null);
        
        // Start recognition
      if (recognitionRef.current) {
        try {
            console.log("Starting speech recognition...");
          recognitionRef.current.start();
          setIsListening(true);
            console.log("Microphone activated successfully");
        } catch (e) {
            console.error("Could not start mic:", e);
          setMicError("Could not start mic: " + (e as Error).message);
            setMicMode(false);
            micModeRef.current = false;
            setIsListening(false);
          }
        } else {
          console.error("Speech recognition not available - recognitionRef.current is null");
          setMicError("Speech recognition not available");
          setMicMode(false);
          micModeRef.current = false;
        }
      } catch (error) {
        console.error("Microphone permission error:", error);
        setMicPermission(false);
        setMicError("Microphone permission denied or unavailable.");
        setMicMode(false);
        micModeRef.current = false;
      }
    }
  };
  const handleToggleAudioMode = () => {
    if (audioMode) {
      setAudioMode(false);
    } else {
      setMicMode(false);
      micModeRef.current = false;
      setAudioMode(true);
      setMicError(null);
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 max-h-full">
      {/* Header with health status and controls */}
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h3 className="text-lg font-semibold text-orange-300 flex items-center">
          <span className="mr-2">₿</span>
          Chat with {avatarName}
        </h3>
        <div className="flex items-center space-x-2">
          {/* Mic mode toggle */}
          <button
            onClick={handleToggleMicMode}
            className={`p-2 rounded-lg transition-colors ${micMode ? "bg-orange-500/20 text-orange-400 border border-orange-400" : "bg-gray-500/20 text-gray-400"} ${micPermission === false ? "opacity-50 cursor-not-allowed" : ""}`}
            title={micPermission === false ? "Microphone not available" : (micMode ? "Mic mode enabled" : "Enable mic mode")}
            disabled={micPermission === false}
          >
            {micMode ? "🎤 On" : "🎤"}
          </button>
          {/* Audio mode toggle */}
          <button
            onClick={handleToggleAudioMode}
            className={`p-2 rounded-lg transition-colors ${audioMode ? "bg-blue-500/20 text-blue-400 border border-blue-400" : "bg-gray-500/20 text-gray-400"} ${ttsSupported ? "" : "opacity-50 cursor-not-allowed"}`}
            title={ttsSupported ? (audioMode ? "Audio mode enabled" : "Enable audio mode") : "Text-to-speech is not supported on this platform."}
            disabled={!ttsSupported}
          >
            {audioMode ? "🔊 On" : "🔊"}
          </button>
          {/* Status indicator */}
          <span className="ml-2 text-xs">
            {micMode ? "Voice chat enabled" : audioMode ? "Audio only" : "Click 🎤 to enable voice"}
          </span>
        </div>
      </div>
      {/* Status/Error messages for Ollama, TTS, and mic */}
      {ollamaLoading && (
        <div className="mb-2 text-xs text-orange-300 bg-black/30 p-2 rounded border border-orange-400 flex items-center gap-2">
          <span className="animate-spin inline-block w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full"></span>
          Loading AI model, please wait...
        </div>
      )}
      {(!healthStatus.isRunning && !micPermission) && (
        <div className="mb-2 text-xs text-red-400 bg-black/30 p-2 rounded border border-red-400">
          Ollama is not running. Please start Ollama and reload the page.
        </div>
      )}
      {healthStatus.isRunning && !healthStatus.modelAvailable && (
        <div className="mb-2 text-xs text-yellow-400 bg-black/30 p-2 rounded border border-yellow-400">
          Ollama model not available. Please pull the model and reload.
        </div>
      )}
      {micError && (
        null // mic error is now only shown via button tooltip
      )}
      {isSpeaking && (
        <div className="mb-2 text-xs text-green-400 bg-black/30 p-2 rounded border border-green-400">
          Speaking (TTS active)...
        </div>
      )}
      {/* Test buttons for TTS and mic */}
      {/*
      <div className="flex gap-2 mb-2">
        <button
          className={`px-3 py-1 rounded bg-blue-500 text-white text-xs ${!ttsSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={() => speakText('This is a test of text to speech.')}
          disabled={!ttsSupported}
          title={!ttsSupported ? 'Text-to-speech is not supported on this platform.' : 'Test text-to-speech'}
        >
          Test TTS
        </button>
        <button
          className={`px-3 py-1 rounded bg-orange-500 text-white text-xs ${!micPermission ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={async () => {
            try {
              await navigator.mediaDevices.getUserMedia({ audio: true });
              setMicPermission(true);
              setMicError(null);
              alert('Mic permission granted!');
            } catch (e) {
              setMicPermission(false);
              setMicError('Mic permission denied or unavailable.');
              alert('Mic permission denied or unavailable.');
            }
          }}
          disabled={!micPermission}
          title={!micPermission ? 'Did you connect a mic?' : 'Test microphone'}
        >
          Test Mic
        </button>
      </div>
      */}

      {/* Health status details */}
      {showHealthStatus && (
        <div className="mb-4 p-3 bg-black/20 rounded-lg text-sm flex-shrink-0 border border-orange-500/20">
          <div className="text-orange-300 mb-2 flex items-center">
            <span className="mr-2">⚡</span>
            AI Service Status:
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-orange-200">Ollama Service:</span>
              <span className={healthStatus.isRunning ? "text-green-400" : "text-red-400"}>
                {healthStatus.isRunning ? "✅ Running" : "❌ Stopped"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-orange-200">Model ({healthStatus.modelName}):</span>
              <span className={healthStatus.modelAvailable ? "text-green-400" : "text-red-400"}>
                {healthStatus.modelAvailable ? "✅ Available" : "❌ Missing"}
              </span>
            </div>
            {healthStatus.error && (
              <div className="text-red-400 text-xs mt-1 p-2 bg-red-500/10 rounded">⚠️ Error: {healthStatus.error}</div>
            )}
          </div>
        </div>
      )}

      {/* Messages area - scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[85%]">
              <div className="flex items-start space-x-2">
                {message.sender === "avatar" && (
                  <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-yellow-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    ₿
                  </div>
                )}
                <div
                  className={`px-4 py-3 rounded-lg shadow-sm text-left ${
                    message.sender === "user"
                      ? "bg-gradient-to-r from-orange-500 to-yellow-500 text-white"
                      : "bg-black/20 text-orange-100 border border-orange-500/20"
                  }`}
                >
                  <div className="text-sm leading-relaxed whitespace-pre-wrap text-left">{message.text}</div>
                  <div
                    className={`text-xs mt-2 opacity-70 text-left ${
                      message.sender === "user" ? "text-orange-100" : "text-orange-300"
                }`}
              >
                    {formatTime(message.timestamp)}
                  </div>
                </div>
                {message.sender === "user" && (
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    U
              </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-start space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-yellow-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                ₿
              </div>
              <div className="bg-black/20 text-orange-100 px-4 py-3 rounded-lg border border-orange-500/20">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-orange-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input form - fixed at bottom */}
      <div className="flex-shrink-0 mt-4 p-4 bg-black/20 rounded-lg border border-orange-500/20">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(inputText);
              }
            }}
            placeholder="Ask about Bitcoin, Lightning, or Nostr..."
            className="w-full min-h-[64px] max-h-40 px-4 py-3 rounded-lg bg-black/30 text-orange-100 placeholder-orange-300/60 border border-orange-500/30 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 resize-vertical text-base"
            disabled={isLoading || !ollamaReady}
            maxLength={config.ui.maxMessageLength}
            rows={3}
          />
          <div className="flex flex-row gap-2 w-full justify-end">
            {/* Only the send button remains */}
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading || !ollamaReady}
              className="px-4 py-2 rounded-lg transition-colors bg-gradient-to-r from-orange-500 to-yellow-500 text-white hover:from-orange-600 hover:to-yellow-600 disabled:bg-gray-500 disabled:cursor-not-allowed font-semibold flex items-center justify-center text-sm"
          >
              {isLoading ? "⏳" : "🚀"}
          </button>
          </div>
        </form>

        {/* Status indicators */}
        <div className="flex items-center justify-between mt-2 text-xs">
          <div className="flex items-center space-x-4">
            {isListening && (
              <span className="text-red-400 animate-pulse flex items-center">
                <span className="mr-1">🎤</span>
                Listening... Speak now
              </span>
            )}
            {isSpeaking && (
              <span className="text-green-400 flex items-center">
                <span className="mr-1">🔊</span>
                Speaking...
              </span>
            )}
          </div>

          <div className="text-orange-300/60">
            {inputText.length}/{config.ui.maxMessageLength}
          </div>
        </div>
      </div>

      {/* Connection Status Alert */}
      {showConnectionAlert && (
        <div className="mt-2 p-3 rounded-lg border border-red-500/30 bg-red-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-red-400">⚠️</span>
              <span className="text-red-300 text-sm">{connectionStatus}</span>
            </div>
            <button
              onClick={() => {
                const connectionMonitor = ConnectionMonitor.getInstance();
                connectionMonitor.forceReconnect();
                setShowConnectionAlert(false);
                setConnectionStatus('Reconnecting...');
              }}
              className="px-3 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
            >
              Reconnect
            </button>
          </div>
        </div>
      )}

      {/* Help text for offline status */}
      {(!healthStatus.isRunning || !healthStatus.modelAvailable) && (
        <div className="mt-2 text-xs text-orange-300/70 text-center bg-black/20 p-3 rounded-lg border border-orange-500/20">
          {!healthStatus.isRunning ? (
            <div className="flex items-center justify-center">
              <span className="mr-2">⚠️</span>
              AI service is offline. Please start Ollama:
              <code className="bg-black/30 px-2 py-1 rounded ml-2 text-orange-400">ollama serve</code>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <span className="mr-2">📦</span>
              Model not found. Please download:
              <code className="bg-black/30 px-2 py-1 rounded ml-2 text-orange-400">
                ollama pull {healthStatus.modelName}
              </code>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
