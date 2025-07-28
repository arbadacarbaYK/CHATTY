import React, { useEffect, useState, useRef } from 'react';

interface AvatarDisplayProps {
  glbUrl: string;
  /**
   * Camera orbit for model-viewer, e.g. '0deg 90deg 3.2m' for full body
   */
  cameraOrbit: string;
  /**
   * Field of view for model-viewer, e.g. '25deg' for wider view
   */
  fieldOfView: string;
  headOnly?: boolean;
  reactTrigger?: number;
  mainPage?: boolean;
  avatarState?: 'idle' | 'thinking' | 'speaking'; // NEW
}

export const AvatarDisplay: React.FC<AvatarDisplayProps> = ({ glbUrl, cameraOrbit = '0deg 90deg 6m', fieldOfView = '30deg', headOnly, reactTrigger, mainPage, avatarState = 'idle' }) => {
  const [ready, setReady] = useState(false);
  const [animClass, setAnimClass] = useState('');
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const modelViewerRef = useRef<any>(null);

  useEffect(() => {
    const loadModelViewer = () => {
      // Check if model-viewer is already available
      if (window.customElements && window.customElements.get('model-viewer')) {
        setReady(true);
        setScriptLoaded(true);
        return;
      }

      // Check if script is already loading
      const existingScript = document.getElementById('model-viewer-script');
      if (existingScript) {
        const check = () => {
          if (window.customElements && window.customElements.get('model-viewer')) {
            setReady(true);
            setScriptLoaded(true);
          } else {
            setTimeout(check, 100);
          }
        };
        check();
        return;
      }

      // Load the script
      const script = document.createElement('script');
      script.type = 'module';
      script.src = 'https://unpkg.com/@google/model-viewer@^3.4.0/dist/model-viewer.min.js';
      script.id = 'model-viewer-script';
      
      script.onload = () => {
        console.log('Model-viewer script loaded successfully');
        const check = () => {
          if (window.customElements && window.customElements.get('model-viewer')) {
            setReady(true);
            setScriptLoaded(true);
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      };
      
      script.onerror = (error) => {
        console.error('Failed to load model-viewer script:', error);
        setScriptLoaded(true); // Mark as loaded to show error state
      };
      
      document.head.appendChild(script);
    };

    loadModelViewer();
  }, []);

  useEffect(() => {
    console.log('AvatarDisplay glbUrl:', glbUrl);
  }, [glbUrl]);

  useEffect(() => {
    if (reactTrigger !== undefined) {
      setAnimClass('animate-pulse');
      const timeout = setTimeout(() => setAnimClass(''), 1000);
      return () => clearTimeout(timeout);
    }
  }, [reactTrigger]);

  // Compute avatar state class
  let stateClass = '';
  if (avatarState === 'thinking') {
    stateClass = 'avatar-thinking';
  } else if (avatarState === 'speaking') {
    stateClass = 'avatar-speaking';
  } else {
    stateClass = 'avatar-idle';
  }

  // Camera orientation logic
  useEffect(() => {
    if (!ready || !modelViewerRef.current) return;
    let orbit = '0deg 90deg 5.5m';
    if (avatarState === 'thinking') {
      orbit = '-45deg 90deg 5.5m';
    }
    // For both idle and speaking, face user
    modelViewerRef.current.setAttribute('camera-orbit', orbit);
  }, [avatarState, ready]);

  // If script failed to load, show error
  if (scriptLoaded && !ready) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ minHeight: headOnly ? 200 : 400 }}>
        <div className="text-white text-center">
          <div className="text-red-400 mb-2">⚠️</div>
          <div className="text-sm">Failed to load 3D avatar component</div>
          <div className="text-xs text-white/60 mt-1">Please refresh the page</div>
        </div>
      </div>
    );
  }

  return (
    <div className={mainPage ? `w-full h-full max-h-[90vh] flex items-center justify-center bg-black/10 ${stateClass}` : `w-full max-w-md aspect-[3/4] max-h-[70vh] mx-auto flex items-center justify-center bg-black/10 ${stateClass}`}>
      {ready ? (
        <model-viewer
          ref={modelViewerRef}
          className={animClass}
          src={glbUrl}
          alt="Ready Player Me Avatar"
          camera-controls
          crossorigin="anonymous"
          style={{ width: '100%', height: '100%', background: 'transparent', objectFit: 'contain', filter: animClass ? 'drop-shadow(0 0 16px orange)' : undefined }}
          camera-orbit="0deg 90deg 5.5m"
          field-of-view="30deg"
          exposure="1.1"
          shadow-intensity="1"
          ar
          camera-target="0m 1m 0m"
          disable-zoom={false}
          onError={() => {
            console.error('Failed to load model:', glbUrl);
            setReady(false);
          }}
        >
          <div slot="poster">Loading avatar...</div>
          <div slot="fallback">Your browser does not support 3D models.</div>
        </model-viewer>
      ) : (
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
          Loading 3D avatar component...
          <div className="mt-2 text-red-400">{!ready && 'Avatar failed to load. Check model path.'}</div>
        </div>
      )}
    </div>
  );
}; 