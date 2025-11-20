import React, { useState, useEffect, useMemo } from 'react';
import { AudioEngine } from './services/audioEngine';
import TechnoCanvas from './components/TechnoCanvas';
import { Note } from './types';

const App: React.FC = () => {
  // Singleton audio engine
  const audioEngine = useMemo(() => new AudioEngine(), []);
  
  const [isStarted, setIsStarted] = useState(false);
  const [currentPitch, setCurrentPitch] = useState<Note>(Note.SILENCE);
  const [showOverlay, setShowOverlay] = useState(true);

  const handleStart = async () => {
    await audioEngine.init();
    audioEngine.start();
    setIsStarted(true);
    setShowOverlay(false);
  };

  // Polling for pitch updates to drive UI state
  useEffect(() => {
    if (!isStarted) return;

    const interval = setInterval(() => {
      const { note } = audioEngine.getPitch();
      setCurrentPitch(note);
    }, 100); // Check pitch every 100ms

    return () => clearInterval(interval);
  }, [isStarted, audioEngine]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#f4f1ea] text-[#1a1a1a]">
      {/* Visualizer Layer */}
      {isStarted && (
        <TechnoCanvas 
          audioEngine={audioEngine} 
          isPlaying={isStarted} 
          currentPitch={currentPitch}
        />
      )}

      {/* UI Overlay */}
      <div className={`absolute inset-0 pointer-events-none flex flex-col justify-between p-8 transition-opacity duration-700 ${showOverlay || !isStarted ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}>
        
        {/* Header */}
        <header className="flex justify-between items-start border-b-4 border-[#1a1a1a] pb-4">
          <div>
            <h1 className="text-6xl font-bold tracking-tighter uppercase">Bauhaus</h1>
            <h2 className="text-4xl font-light tracking-widest uppercase text-[#D02120]">Techno Vision</h2>
          </div>
          <div className="text-right hidden md:block">
            <p className="text-sm font-bold">SESSION ID: {Math.random().toString(36).substring(7).toUpperCase()}</p>
            <p className="text-sm">ROUTE: /{currentPitch === Note.SILENCE ? 'WAIT' : currentPitch}</p>
          </div>
        </header>

        {/* Start Prompt */}
        {!isStarted && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#f4f1ea]/90 pointer-events-auto z-50">
            <div className="text-center max-w-md">
              <div className="w-24 h-24 bg-[#1f3b97] rounded-full mx-auto mb-8 animate-pulse"></div>
              <p className="mb-8 text-lg font-medium">
                Camera and Microphone access required for audiovisual synthesis.
                <br/>
                <span className="text-xs text-gray-500 block mt-2">Using Gemini 2.5 Vision & Imagen 3/4</span>
              </p>
              <button 
                onClick={handleStart}
                className="bg-[#1a1a1a] text-[#f4f1ea] px-12 py-4 text-xl font-bold hover:bg-[#D02120] transition-colors uppercase tracking-wider clip-path-slant"
                style={{ clipPath: 'polygon(10% 0, 100% 0, 90% 100%, 0% 100%)' }}
              >
                Initialize System
              </button>
            </div>
          </div>
        )}

        {/* Footer / Status */}
        <footer className="flex justify-between items-end border-t-4 border-[#1a1a1a] pt-4 pointer-events-auto">
          <div className="flex gap-4">
             <div className={`w-8 h-8 ${currentPitch !== Note.SILENCE ? 'bg-[#F2B705]' : 'bg-gray-300'} transition-colors duration-100`}></div>
             <div className={`w-8 h-8 rounded-full ${currentPitch !== Note.SILENCE ? 'bg-[#D02120]' : 'bg-gray-300'} transition-colors duration-100 delay-75`}></div>
             <div className={`w-8 h-8 ${currentPitch !== Note.SILENCE ? 'bg-[#1f3b97]' : 'bg-gray-300'} transition-colors duration-100 delay-150`} style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}></div>
          </div>
          
          <div className="text-right">
             <p className="text-xs font-mono">AUDIO_WORKER: {isStarted ? 'ACTIVE' : 'IDLE'}</p>
             <p className="text-xs font-mono">GEMINI_UPLINK: {isStarted ? 'CONNECTED' : 'OFFLINE'}</p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;