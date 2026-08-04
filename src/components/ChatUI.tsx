import type React from "react"
import { useState, useEffect, useRef } from "react"
import { ChatService } from "../services/chatService"
import { ConnectionMonitor, type ConnectionEvent } from "../services/connectionMonitor"
import { config } from "../config/appConfig"

interface Message {
  sender: "user" | "avatar"
  text: string
  timestamp: number
  sources?: Array<{ url: string }>
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
  setAvatarState?: (state: "idle" | "thinking" | "speaking") => void
  avatarName?: string
}

export const ChatUI: React.FC<ChatUIProps> = ({
  skillLevel,
  onReact,
  setAvatarState,
  avatarName = "Satoshe",
}) => {
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
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [micMode, setMicMode] = useState(false)
  const [audioMode, setAudioMode] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const [micPermission, setMicPermission] = useState<boolean | null>(null)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [browserTtsSupported, setBrowserTtsSupported] = useState(false)
  const [localTtsSupported, setLocalTtsSupported] = useState(false)
  const [ttsError, setTtsError] = useState<string | null>(null)
  const [ollamaReady, setOllamaReady] = useState(false)
  const [ollamaLoading, setOllamaLoading] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState<string>("Checking connections...")
  const [showConnectionAlert, setShowConnectionAlert] = useState(false)
  const [isSending, setIsSending] = useState(false)

  const recognitionRef = useRef<any>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const micModeRef = useRef(false)
  /** Survives mic-mode clear so the reply still gets spoken after voice input */
  const speakAfterReplyRef = useRef(false)
  const audioElRef = useRef<HTMLAudioElement | null>(null)

  const chatService = ChatService.getInstance()
  const ttsAvailable = browserTtsSupported || localTtsSupported

  useEffect(() => {
    setOllamaLoading(true)

    const connectionMonitor = ConnectionMonitor.getInstance()
    connectionMonitor.startMonitoring()

    const handleConnectionEvent = (event: ConnectionEvent) => {
      if (event.type === "disconnected") {
        setShowConnectionAlert(true)
        setConnectionStatus(`Connection lost: ${event.service}`)
      } else if (event.type === "connected" || event.type === "reconnected") {
        setShowConnectionAlert(false)
        setConnectionStatus("All services connected")
      }
    }

    connectionMonitor.addEventListener(handleConnectionEvent)

    chatService.checkHealth().then((health) => {
      setHealthStatus(health)
      setOllamaReady(health.isRunning && health.modelAvailable)
      setOllamaLoading(false)

      const status = connectionMonitor.getStatus()
      if (status.ollama.isRunning && status.backend.isRunning) {
        setConnectionStatus("All services connected")
      } else {
        setConnectionStatus(connectionMonitor.getConnectionSummary())
        setShowConnectionAlert(true)
      }
    })

    initializeSpeech()
    checkLocalTts()

    return () => {
      connectionMonitor.removeEventListener(handleConnectionEvent)
      connectionMonitor.stopMonitoring()
      stopSpeaking()
      try {
        recognitionRef.current?.stop()
      } catch {
        /* ignore */
      }
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (isSpeaking) {
      setAvatarState?.("speaking")
    } else if (isLoading) {
      setAvatarState?.("thinking")
    } else {
      setAvatarState?.("idle")
    }
  }, [isLoading, isSpeaking, setAvatarState])

  const checkLocalTts = async () => {
    try {
      const res = await fetch("/tts/status")
      if (!res.ok) {
        setLocalTtsSupported(false)
        return
      }
      const data = await res.json()
      setLocalTtsSupported(Boolean(data.available))
      if (data.available) {
        setTtsError(null)
      }
    } catch {
      setLocalTtsSupported(false)
    }
  }

  const initializeSpeech = () => {
    if (typeof window === "undefined") return

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (SpeechRecognitionCtor) {
      setSpeechSupported(true)
      const recognition = new SpeechRecognitionCtor()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = "en-US"

      recognition.onresult = (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript
        setInputText("")
        if (micModeRef.current) {
          // Keep speak intent even after we turn micMode off
          speakAfterReplyRef.current = true
          setAudioMode(true)
          handleSend(transcript, true)
          setIsListening(false)
          setMicMode(false)
          micModeRef.current = false
        } else {
          setInputText(transcript)
          setIsListening(false)
        }
      }

      recognition.onerror = (event: any) => {
        setIsListening(false)
        setMicError(`Speech recognition error: ${event.error}`)
        setMicMode(false)
        micModeRef.current = false
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
    } else {
      setSpeechSupported(false)
      setMicError(
        "Speech recognition needs Chromium/Brave (Web Speech API). Firefox usually cannot do mic→text in the browser."
      )
    }

    if (window.speechSynthesis) {
      synthRef.current = window.speechSynthesis
      let pollCount = 0
      const maxPolls = 20
      const pollVoices = () => {
        const voices = window.speechSynthesis.getVoices()
        if (voices && voices.length > 0) {
          setBrowserTtsSupported(true)
          setTtsError(null)
        } else if (pollCount < maxPolls) {
          pollCount++
          setTimeout(pollVoices, 100)
        } else {
          setBrowserTtsSupported(false)
          // Local espeak may still work — only warn if both missing
          setTtsError(
            "Browser has no TTS voices (common on Linux). Using local espeak-ng if the backend is running."
          )
        }
      }
      pollVoices()
      window.speechSynthesis.onvoiceschanged = pollVoices
    }
  }

  const stopSpeaking = () => {
    synthRef.current?.cancel()
    if (audioElRef.current) {
      audioElRef.current.pause()
      audioElRef.current.src = ""
      audioElRef.current = null
    }
    setIsSpeaking(false)
  }

  const speakWithBrowser = (text: string): boolean => {
    if (!synthRef.current || !browserTtsSupported) return false
    synthRef.current.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.95
    utterance.pitch = 1
    utterance.volume = 0.9
    utterance.lang = "en-US"
    const voices = synthRef.current.getVoices()
    const preferred = voices.find(
      (voice) =>
        voice.lang.toLowerCase().startsWith("en") &&
        (voice.name.includes("Google") || voice.name.includes("Microsoft") || voice.localService)
    )
    if (preferred) utterance.voice = preferred
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    synthRef.current.speak(utterance)
    return true
  }

  const speakWithLocalTts = async (text: string): Promise<boolean> => {
    if (!localTtsSupported) return false
    try {
      const res = await fetch("/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 1800) }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setTtsError(err.error || "Local TTS failed")
        return false
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      stopSpeaking()
      const audio = new Audio(url)
      audioElRef.current = audio
      setIsSpeaking(true)
      audio.onended = () => {
        setIsSpeaking(false)
        URL.revokeObjectURL(url)
      }
      audio.onerror = () => {
        setIsSpeaking(false)
        URL.revokeObjectURL(url)
      }
      await audio.play()
      return true
    } catch (e) {
      setTtsError(e instanceof Error ? e.message : "Local TTS failed")
      return false
    }
  }

  const speakText = async (text: string) => {
    if (!speakAfterReplyRef.current && !audioMode && !micMode) return
    if (!text.trim()) return

    if (speakWithBrowser(text)) return
    const ok = await speakWithLocalTts(text)
    if (!ok && !browserTtsSupported) {
      setTtsError(
        "No voice available. Install espeak-ng (`sudo apt install espeak-ng`) and keep the CHATTY backend running."
      )
    }
  }

  const handleSend = async (text: string, fromVoice = false) => {
    if (!text.trim() || isSending) return

    if (fromVoice || audioMode || micMode) {
      speakAfterReplyRef.current = true
    }

    if (text.length > config.ui.maxMessageLength) {
      alert(`Message too long. Maximum ${config.ui.maxMessageLength} characters allowed.`)
      return
    }

    if (!ollamaReady) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "avatar",
          text: "AI is still loading. Please wait a moment and try again.",
          timestamp: Date.now(),
        },
      ])
      return
    }

    setIsSending(true)
    setMessages((prev) => [
      ...prev,
      { sender: "user", text, timestamp: Date.now() },
    ])
    setInputText("")
    setIsLoading(true)
    onReact?.()

    try {
      const response = await chatService.sendMessage(text, skillLevel, avatarName)

      if (!response.success) {
        let errorMessage =
          "I'm sorry, there was an error processing your request. Please try again."
        if (response.error?.includes("timeout") || response.error?.includes("ECONNABORTED")) {
          errorMessage =
            "I'm sorry, the AI model is taking longer than expected. Please try again in a moment."
        } else if (
          response.error?.includes("Network Error") ||
          response.error?.includes("Failed to fetch") ||
          response.error?.includes("Connection")
        ) {
          errorMessage =
            "Connection issue. Check that Ollama and the CHATTY backend are running."
        } else if (response.response) {
          errorMessage = response.response
        }
        setMessages((prev) => [
          ...prev,
          { sender: "avatar", text: errorMessage, timestamp: Date.now() },
        ])
        return
      }

      setMessages((prev) => [
        ...prev,
        {
          sender: "avatar",
          text: response.response,
          timestamp: Date.now(),
          sources: response.sources,
        },
      ])
      onReact?.()

      if (speakAfterReplyRef.current || audioMode || micMode) {
        await speakText(response.response)
      }
    } catch (error) {
      console.error("Error sending message:", error)
      setMessages((prev) => [
        ...prev,
        {
          sender: "avatar",
          text: "Sorry, I encountered an error. Please check if Ollama is running and try again.",
          timestamp: Date.now(),
        },
      ])
    } finally {
      setIsLoading(false)
      setIsSending(false)
      // One-shot speak flag for mic turns; audio mode keeps speaking on
      if (!audioMode) {
        speakAfterReplyRef.current = false
      }
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSend(inputText)
  }

  const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

  const handleToggleMicMode = async () => {
    if (micMode) {
      setMicMode(false)
      micModeRef.current = false
      setIsListening(false)
      try {
        recognitionRef.current?.stop()
      } catch {
        /* ignore */
      }
      return
    }

    if (!speechSupported || !recognitionRef.current) {
      setMicError(
        "Speech recognition not available. Use Chromium/Brave, or type your question."
      )
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
      setMicPermission(true)
      setMicError(null)

      // Voice chat = listen + speak replies (local TTS on Linux)
      setAudioMode(true)
      speakAfterReplyRef.current = true
      setMicMode(true)
      micModeRef.current = true

      try {
        recognitionRef.current.start()
        setIsListening(true)
      } catch (e) {
        setMicError("Could not start mic: " + (e as Error).message)
        setMicMode(false)
        micModeRef.current = false
        setIsListening(false)
      }
    } catch {
      setMicPermission(false)
      setMicError("Microphone permission denied. Allow mic access and try again.")
      setMicMode(false)
      micModeRef.current = false
    }
  }

  const handleToggleAudioMode = () => {
    if (audioMode) {
      setAudioMode(false)
      speakAfterReplyRef.current = false
      stopSpeaking()
    } else {
      setMicMode(false)
      micModeRef.current = false
      setAudioMode(true)
      speakAfterReplyRef.current = true
      setMicError(null)
      try {
        recognitionRef.current?.stop()
      } catch {
        /* ignore */
      }
      setIsListening(false)
      if (!ttsAvailable) {
        setTtsError(
          "No TTS yet. Start the backend and install espeak-ng, or use a browser with voices."
        )
      }
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 max-h-full">
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h3 className="text-lg font-semibold text-orange-300 flex items-center">
          <span className="mr-2">₿</span>
          Chat with {avatarName}
        </h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleToggleMicMode}
            className={`p-2 rounded-lg transition-colors ${
              micMode
                ? "bg-orange-500/20 text-orange-400 border border-orange-400"
                : "bg-gray-500/20 text-gray-400"
            } ${!speechSupported ? "opacity-50" : ""}`}
            title={
              !speechSupported
                ? "Speech recognition needs Chromium/Brave"
                : micMode
                  ? "Mic mode on — click to stop"
                  : "Talk to CHATTY (mic + spoken replies)"
            }
          >
            {micMode ? "🎤 On" : "🎤"}
          </button>
          <button
            onClick={handleToggleAudioMode}
            className={`p-2 rounded-lg transition-colors ${
              audioMode
                ? "bg-blue-500/20 text-blue-400 border border-blue-400"
                : "bg-gray-500/20 text-gray-400"
            }`}
            title={
              ttsAvailable
                ? audioMode
                  ? "Spoken replies on"
                  : "Enable spoken replies"
                : "TTS: browser voices or local espeak-ng via backend"
            }
          >
            {audioMode ? "🔊 On" : "🔊"}
          </button>
          <span className="ml-2 text-xs text-orange-200/80">
            {micMode
              ? "Voice chat"
              : audioMode
                ? "Spoken replies"
                : localTtsSupported
                  ? "Click 🎤 or 🔊 (local voice ready)"
                  : "Click 🎤 or 🔊"}
          </span>
        </div>
      </div>

      {ollamaLoading && (
        <div className="mb-2 text-xs text-orange-300 bg-black/30 p-2 rounded border border-orange-400 flex items-center gap-2">
          <span className="animate-spin inline-block w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full"></span>
          Loading AI model, please wait...
        </div>
      )}
      {!healthStatus.isRunning && (
        <div className="mb-2 text-xs text-red-400 bg-black/30 p-2 rounded border border-red-400">
          Ollama is not running. Install from https://ollama.com then run{" "}
          <code className="text-orange-300">ollama serve</code> and{" "}
          <code className="text-orange-300">ollama pull {healthStatus.modelName}</code>.
        </div>
      )}
      {healthStatus.isRunning && !healthStatus.modelAvailable && (
        <div className="mb-2 text-xs text-yellow-400 bg-black/30 p-2 rounded border border-yellow-400">
          Model missing. Run: <code>ollama pull {healthStatus.modelName}</code>
        </div>
      )}
      {micError && (
        <div className="mb-2 text-xs text-yellow-300 bg-black/30 p-2 rounded border border-yellow-500/40">
          {micError}
        </div>
      )}
      {ttsError && !ttsAvailable && (
        <div className="mb-2 text-xs text-yellow-300 bg-black/30 p-2 rounded border border-yellow-500/40">
          {ttsError}
        </div>
      )}
      {isSpeaking && (
        <div className="mb-2 text-xs text-green-400 bg-black/30 p-2 rounded border border-green-400">
          Speaking...
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
          >
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
                  <div className="text-sm leading-relaxed whitespace-pre-wrap text-left">
                    {message.text}
                  </div>
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-2 text-xs text-orange-300/80 space-y-0.5">
                      <div className="opacity-70">Sources</div>
                      {message.sources.map((s, i) => (
                        <a
                          key={i}
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate underline hover:text-orange-200"
                        >
                          [{i + 1}] {s.url}
                        </a>
                      ))}
                    </div>
                  )}
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
                  <div
                    className="w-2 h-2 bg-orange-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex-shrink-0 mt-4 p-4 bg-black/20 rounded-lg border border-orange-500/20">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSend(inputText)
              }
            }}
            placeholder="Ask about Bitcoin, Lightning, Cashu, or Nostr..."
            className="w-full min-h-[64px] max-h-40 px-4 py-3 rounded-lg bg-black/30 text-orange-100 placeholder-orange-300/60 border border-orange-500/30 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 resize-vertical text-base"
            disabled={isLoading || !ollamaReady}
            maxLength={config.ui.maxMessageLength}
            rows={3}
          />
          <div className="flex flex-row gap-2 w-full justify-end">
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading || !ollamaReady}
              className="px-4 py-2 rounded-lg transition-colors bg-gradient-to-r from-orange-500 to-yellow-500 text-white hover:from-orange-600 hover:to-yellow-600 disabled:bg-gray-500 disabled:cursor-not-allowed font-semibold flex items-center justify-center text-sm"
            >
              {isLoading ? "⏳" : "🚀"}
            </button>
          </div>
        </form>

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
            {micPermission === false && (
              <span className="text-yellow-400">Mic blocked — allow access to retry</span>
            )}
          </div>
          <div className="text-orange-300/60">
            {inputText.length}/{config.ui.maxMessageLength}
          </div>
        </div>
      </div>

      {showConnectionAlert && (
        <div className="mt-2 p-3 rounded-lg border border-red-500/30 bg-red-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-red-400">⚠️</span>
              <span className="text-red-300 text-sm">{connectionStatus}</span>
            </div>
            <button
              onClick={() => {
                const connectionMonitor = ConnectionMonitor.getInstance()
                connectionMonitor.forceReconnect()
                setShowConnectionAlert(false)
                setConnectionStatus("Reconnecting...")
                checkLocalTts()
              }}
              className="px-3 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
            >
              Reconnect
            </button>
          </div>
        </div>
      )}

      {(!healthStatus.isRunning || !healthStatus.modelAvailable) && (
        <div className="mt-2 text-xs text-orange-300/70 text-center bg-black/20 p-3 rounded-lg border border-orange-500/20">
          {!healthStatus.isRunning ? (
            <div>
              AI offline — start Ollama:{" "}
              <code className="bg-black/30 px-2 py-1 rounded text-orange-400">ollama serve</code>
            </div>
          ) : (
            <div>
              Download model:{" "}
              <code className="bg-black/30 px-2 py-1 rounded text-orange-400">
                ollama pull {healthStatus.modelName}
              </code>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
