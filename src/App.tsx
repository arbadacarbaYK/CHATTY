import { useState, useEffect } from 'react';
import { AvatarDisplay } from './components/AvatarDisplay';
import { ChatUI } from './components/ChatUI';
import { ChatService } from './services/chatService';
import { config } from './config/appConfig';
import './App.css';
import KnowledgeAdmin from './components/KnowledgeAdmin';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';

type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

function AppContent() {
  const avatars = [
    {
      name: 'Satoshe',
      label: 'Bitcoin Guide',
      glbUrl: 'https://models.readyplayer.me/6880d2d61f1087112a37ef6a.glb',
    },
    {
      name: 'LightningMan',
      label: 'Lightning Network',
      glbUrl: 'https://models.readyplayer.me/688395345261d5d7f3da5115.glb',
    },
    {
      name: 'CashuMan',
      label: 'Cashu Ecash',
      glbUrl: 'https://models.readyplayer.me/6883970fb7044236df56473c.glb',
    },
    {
      name: 'Nostr Wizard',
      label: 'Nostr Protocol',
      glbUrl: 'https://models.readyplayer.me/688392567e015158a5e70f21.glb',
    },
  ];
  const [selectedAvatarIdx, setSelectedAvatarIdx] = useState(0);
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('beginner');
  const [isStarted, setIsStarted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [reactTrigger, setReactTrigger] = useState(0);
  const [avatarState, setAvatarState] = useState<'idle' | 'thinking' | 'speaking'>('idle');
  const [modelWarmedUp, setModelWarmedUp] = useState(false);
  const [warmupStatus, setWarmupStatus] = useState<string>('Checking AI model...');

  // Enhanced model warmup on app startup
  useEffect(() => {
    const warmupModel = async () => {
      try {
        console.log('Warming up Ollama model...');
        setWarmupStatus('Checking Ollama service...');
        
        const chatService = ChatService.getInstance();
        const health = await chatService.checkHealth();
        
        if (!health.isRunning) {
          setWarmupStatus('Ollama service not running');
          return;
        }
        
        if (!health.modelAvailable) {
          setWarmupStatus('AI model not available');
          return;
        }
        
        setWarmupStatus('Loading AI model into memory...');
        
        // Send a proper warmup message to load the model into memory
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minute timeout for warmup
        
        try {
          const response = await fetch(`${config.ollama.url}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: config.ollama.model,
              prompt: 'You are Satoshe, a friendly Bitcoin education guide. Please respond with a brief welcome message.',
              stream: false,
              options: {
                temperature: 0.7,
                num_predict: 50,
                num_ctx: 2048,
                num_thread: 2,
              },
            }),
            signal: controller.signal,
          });
          
                    clearTimeout(timeoutId);
          
          if (response.ok) {
            console.log('Model warmup successful');
            setModelWarmedUp(true);
            setWarmupStatus('AI model ready');
          } else {
            console.warn('Model warmup failed');
            setWarmupStatus('AI model warmup failed');
          }
        } catch (error: any) {
          clearTimeout(timeoutId);
          if (error.name === 'AbortError') {
            console.warn('Model warmup timed out');
            setWarmupStatus('AI model warmup timed out - will load on first use');
          } else {
            console.warn('Model warmup failed:', error);
            setWarmupStatus('AI model warmup failed - will load on first use');
          }
        }
      } catch (error) {
        console.warn('Model warmup failed, will load on first use:', error);
        setWarmupStatus('AI model warmup failed - will load on first use');
      }
    };

    warmupModel();
  }, []);

  // Check if mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < config.ui.mobileBreakpoint);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleStart = async () => {
    // Double-check model readiness before starting
    if (!modelWarmedUp) {
      setWarmupStatus('Final check before starting...');
      try {
        const chatService = ChatService.getInstance();
        const health = await chatService.checkHealth();
        if (health.isRunning && health.modelAvailable) {
          setModelWarmedUp(true);
          setWarmupStatus('AI model ready');
        } else {
          setWarmupStatus('AI model not ready - please wait');
          return;
        }
      } catch (error) {
        console.error('Final health check failed:', error);
        setWarmupStatus('AI model not ready - please wait');
        return;
      }
    }
    
    setIsStarted(true);
  };

  const handleBackToMenu = () => {
    setIsStarted(false);
    // Clear chat history when going back to menu
    const chatService = ChatService.getInstance();
    chatService.clearHistory();
  };

  const getSkillLevelDescription = (level: SkillLevel) => {
    switch (level) {
      case 'beginner':
        return 'New to Bitcoin? Start here with the basics!';
      case 'intermediate':
        return 'Know some Bitcoin? Let\'s dive deeper!';
      case 'advanced':
        return 'Bitcoin expert? Let\'s explore advanced topics!';
    }
  };

  if (!isStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 w-full max-w-6xl flex flex-col md:flex-row gap-8 text-center md:text-left h-full min-h-[400px]">
          {/* Left: Avatar selection */}
          <div className="flex-1 flex flex-col items-center justify-center">
              <h2 className="text-xl font-semibold text-white mb-4">Choose Your Avatar</h2>
            <div className="grid grid-cols-2 gap-6 w-full max-w-xl mx-auto">
                {avatars.map((avatar, idx) => (
                  <button
                    key={avatar.name}
                    onClick={() => setSelectedAvatarIdx(idx)}
                    className={`p-2 rounded-lg border-2 transition-all w-full flex flex-col items-center ${selectedAvatarIdx === idx ? 'bg-orange-400/20' : 'border-white/30 bg-white/10 hover:bg-white/20'}`}
                  >
                    <div className="w-32 h-44 bg-gradient-to-br from-blue-400 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-lg overflow-hidden">
                      <AvatarDisplay glbUrl={avatar.glbUrl} cameraOrbit="0deg 90deg 5.5m" fieldOfView="12deg" headOnly={false} />
                    </div>
                    <p className="text-white mt-2 truncate max-w-[7.5rem] text-center" title={avatar.name}>{avatar.name}</p>
                  </button>
                ))}
              </div>
            </div>
          {/* Right: Skillset and start */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <h1 className="text-4xl font-bold text-white mb-6 md:mb-8">Satoshe ChatClass</h1>
            <p className="text-white/80 mb-8 text-lg max-w-md">Learn about Bitcoin, Lightning Network, Cashu, and Nostr through interactive conversations with our AI avatars.</p>
            <div className="w-full max-w-md space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">I am a ..</h2>
              <div className="space-y-3">
                {(['beginner', 'intermediate', 'advanced'] as SkillLevel[]).map((level) => (
                  <button
                    key={level}
                    onClick={() => setSkillLevel(level)}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left ${skillLevel === level ? 'border-orange-400 bg-orange-400/20' : 'border-white/30 bg-white/10 hover:bg-white/20'}`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-white font-semibold capitalize">{level}</div>
                        <div className="text-white/60 text-sm">{getSkillLevelDescription(level)}</div>
                      </div>
                      {skillLevel === level && (
                        <div className="w-6 h-6 bg-orange-400 rounded-full flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleStart}
              disabled={!modelWarmedUp}
              className={`px-8 py-4 rounded-lg font-semibold text-lg transition-all transform w-full ${
                modelWarmedUp 
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 hover:scale-105' 
                  : 'bg-gray-500 text-gray-300 cursor-not-allowed'
              }`}
            >
              {modelWarmedUp ? 'Start Learning' : 'Loading AI Model...'}
            </button>
              <div className="text-white/60 text-sm text-center">
                <p>💡 This app uses local AI (Ollama)</p>
                <p>🔒 Your conversations never leave your device</p>
                {!modelWarmedUp && (
                  <div className="mt-2">
                    <p className="text-orange-300">🔄 {warmupStatus}</p>
                    <p className="text-orange-200 text-xs mt-1">Please wait for AI model to load...</p>
                  </div>
                )}
                {modelWarmedUp && (
                  <p className="text-green-300 mt-2">✅ AI model ready</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mobile layout
  if (isMobile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex flex-col">
        {/* Fixed Header */}
        <div className="bg-white/10 backdrop-blur-lg p-4 flex-shrink-0 sticky top-0 z-20">
          <div className="flex justify-between items-center">
            <button
              onClick={handleBackToMenu}
              className="text-white hover:text-orange-400 transition-colors"
            >
              ← Back
            </button>
            <h1 className="text-lg font-semibold text-white">Bitcoin Education</h1>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="text-white hover:text-orange-400 transition-colors"
            >
              ⚙️
            </button>
          </div>
          {showSettings && (
            <div className="mt-4 p-3 bg-white/10 rounded-lg">
              <div className="text-white text-sm">
                <div className="mb-2">Skill Level: <span className="text-orange-400 capitalize">{skillLevel}</span></div>
                <div className="text-white/60 text-xs">
                  {getSkillLevelDescription(skillLevel)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Avatar Section */}
        <div className="flex-1 flex items-center justify-center h-full max-h-[80vh] p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 w-full max-w-sm">
            <AvatarDisplay glbUrl={avatars[selectedAvatarIdx].glbUrl} cameraOrbit="0deg 90deg 5.5m" fieldOfView="12deg" headOnly={false} reactTrigger={reactTrigger} mainPage={true} avatarState={avatarState} />
            <div className="text-center mt-4">
              <h2 className="text-xl font-bold text-white mb-2 truncate max-w-[12rem]" title={avatars[selectedAvatarIdx].name}>{avatars[selectedAvatarIdx].name}</h2>
              <p className="text-white/80 text-sm">Your Bitcoin Education Guide</p>
              <div className="mt-2">
                <span className="inline-block bg-orange-500/20 text-orange-300 px-3 py-1 rounded-full text-sm capitalize">
                  {skillLevel}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Section */}
        <div className="bg-white/10 backdrop-blur-lg p-4 flex-shrink-0">
          <ChatUI skillLevel={skillLevel} onReact={() => setReactTrigger((prev) => prev + 1)} setAvatarState={setAvatarState} avatarName={avatars[selectedAvatarIdx].name} />
        </div>
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex">
      {/* Header */}
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={handleBackToMenu}
          className="bg-white/10 backdrop-blur-lg text-white p-2 rounded-lg hover:bg-white/20 transition-colors"
          title="Back to Menu"
        >
          🏠
        </button>
      </div>

      {/* Avatar Section */}
      <div className="w-1/3 h-screen flex flex-col p-8">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 w-full h-full flex flex-col">
          <div className="flex-1 flex items-center justify-center h-full max-h-[80vh]">
            <AvatarDisplay glbUrl={avatars[selectedAvatarIdx].glbUrl} cameraOrbit="0deg 90deg 5.5m" fieldOfView="12deg" headOnly={false} reactTrigger={reactTrigger} mainPage={true} avatarState={avatarState} />
          </div>
          <div className="flex flex-col items-center text-center mt-4 flex-shrink-0">
            <h2 className="text-2xl font-bold text-white mb-2 truncate max-w-[16rem] w-full text-center" title={avatars[selectedAvatarIdx].name}>{avatars[selectedAvatarIdx].name}</h2>
            <p className="text-white/80">Your Bitcoin Education Guide</p>
            <div className="mt-2">
              <span className="inline-block bg-orange-500/20 text-orange-300 px-3 py-1 rounded-full text-sm capitalize">
                {skillLevel}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Section */}
      <div className="w-2/3 h-screen flex flex-col p-8">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 w-full h-full flex flex-col">
          <ChatUI skillLevel={skillLevel} onReact={() => setReactTrigger((prev) => prev + 1)} setAvatarState={setAvatarState} avatarName={avatars[selectedAvatarIdx].name} />
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <div>
        {/* TODO: Only show to admin */}
        <div className="fixed top-4 left-4 z-50">
          <Link 
            to="/input" 
            className="bg-white/10 backdrop-blur-lg text-white p-2 rounded-lg hover:bg-white/20 transition-colors"
            title="Knowledge Admin"
          >
            📚
          </Link>
        </div>
        <Routes>
          <Route path="/input" element={<KnowledgeAdmin />} />
          <Route path="/*" element={<AppContent />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
