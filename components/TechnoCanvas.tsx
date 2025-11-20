import React, { useRef, useEffect, useState, useCallback } from 'react';
import { AudioEngine } from '../services/audioEngine';
import { Note, ImageMap } from '../types';
import { describeImage, generateBauhausImage } from '../services/geminiService';

interface Props {
  audioEngine: AudioEngine;
  isPlaying: boolean;
  currentPitch: Note;
}

// Visual Object for the "Drifting" effect
class VisualEcho {
  image: HTMLImageElement;
  x: number;
  y: number;
  opacity: number;
  scale: number;
  width: number;
  height: number;

  constructor(imgSrc: string, canvasWidth: number, canvasHeight: number) {
    this.image = new Image();
    this.image.src = imgSrc;
    this.opacity = 1.0;
    this.scale = 1.0; 
    
    this.width = canvasWidth;
    this.height = canvasHeight;
    
    // Start centered
    this.x = canvasWidth / 2;
    this.y = canvasHeight / 2;
  }

  update() {
    // "image layer disapear evry render a fraction, in back:opacity-, x/y -1"
    this.opacity -= 0.008; 
    
    // Drift Top-Left
    this.x -= 1.5; 
    this.y -= 1.5; 
    
    // "scale -1-1 too" -> shrink into background
    this.scale -= 0.003;

    if (this.scale < 0) this.scale = 0;
  }

  isDead() {
    return this.opacity <= 0 || this.scale <= 0.1;
  }
}

const TechnoCanvas: React.FC<Props> = ({ audioEngine, isPlaying, currentPitch }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Logic Refs
  const imageMapRef = useRef<ImageMap>({});
  const visualEchoesRef = useRef<VisualEcho[]>([]);
  const isGeneratingRef = useRef(false);
  const subtitleRef = useRef<string>("INITIALIZING VISION SYSTEM...");

  // Register Audio Callback
  useEffect(() => {
    audioEngine.setNoteCallback((note, type) => {
      // "when a note is play ing and have a image assigned draw that on top"
      const map = imageMapRef.current;
      
      // Try exact note match, then fallback to 'C' (Kick/Bass center), then fallback to any available
      const imgSrc = map[note] || map[Note.C] || Object.values(map)[0];
      
      if (imgSrc && canvasRef.current) {
        const echo = new VisualEcho(imgSrc, canvasRef.current.width, canvasRef.current.height);
        visualEchoesRef.current.push(echo);
      }
    });
  }, [audioEngine]);

  // Start Camera
  useEffect(() => {
    const startVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } catch (err) {
        console.error("Camera error", err);
        subtitleRef.current = "CAMERA ERROR: SIGNAL LOST";
      }
    };
    startVideo();
  }, []);

  // AI Generation Loop (Iterative)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const runGenLoop = async () => {
        if (!isPlaying) return;
        if (isGeneratingRef.current) return;

        isGeneratingRef.current = true;

        try {
            // 1. Capture
            if (!videoRef.current || !canvasRef.current) throw new Error("No video");
            
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = 320; 
            tempCanvas.height = 240;
            const ctx = tempCanvas.getContext('2d');
            if (!ctx) return;
            
            // Mirror capture for natural feel
            ctx.translate(320, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(videoRef.current, 0, 0, 320, 240);
            
            const base64 = tempCanvas.toDataURL('image/jpeg', 0.6);

            // 2. Describe ("ask for a description of image")
            subtitleRef.current = "SCANNING SCENE...";
            const description = await describeImage(base64);
            
            // Show as subtitle
            subtitleRef.current = `>> ${description.toUpperCase()}`;

            // 3. Map to Current Audio Context
            // "map to the recivesde image... default bass is playing... or both"
            const detected = audioEngine.getPitch();
            const targetNote = detected.note !== Note.SILENCE 
                ? detected.note 
                : (Math.random() > 0.4 ? Note.C : Note.A); // Bias towards Kick(C) and Bass(A)

            // 4. Generate ("based on the {desc} cretae a fitting situation")
            const generatedUrl = await generateBauhausImage(description, targetNote);
            
            if (generatedUrl) {
                imageMapRef.current[targetNote] = generatedUrl;
                
                // Instant feedback: Add to visual stack immediately
                const echo = new VisualEcho(generatedUrl, canvasRef.current.width, canvasRef.current.height);
                visualEchoesRef.current.push(echo);
            }

        } catch (e) {
            console.error("Gen Loop Error", e);
        } finally {
            isGeneratingRef.current = false;
            // "generating must be iterativ, so do after generation wait a sec"
            timeoutId = setTimeout(runGenLoop, 1500); 
        }
    };

    if (isPlaying) {
        runGenLoop();
    }

    return () => clearTimeout(timeoutId);
  }, [isPlaying, audioEngine]);


  // Main Render Loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // --- LAYER 0: Background ---
    ctx.fillStyle = '#f4f1ea'; 
    ctx.fillRect(0, 0, width, height);

    // --- LAYER 1: Live Camera (50% opacity) ---
    // "50% live cam" - Drawn BEFORE the generated art so art is "on top" when fresh
    if (video.readyState === 4) {
        ctx.save();
        ctx.globalAlpha = 0.5; 
        ctx.filter = 'grayscale(100%) contrast(150%) sepia(20%)'; // Bauhaus photo style
        
        const scale = Math.max(width / video.videoWidth, height / video.videoHeight);
        const x = (width - video.videoWidth * scale) / 2;
        const y = (height - video.videoHeight * scale) / 2;
        
        ctx.drawImage(video, x, y, video.videoWidth * scale, video.videoHeight * scale);
        ctx.restore();
    }

    // --- LAYER 2: Visual Echoes (The Art) ---
    // "when a note is play ing and have a image assigned draw that on top"
    // We iterate backwards to delete dead ones, but drawing order matters.
    // To draw "on top", we should draw the NEWEST last. 
    // visualEchoesRef contains [old, ..., new].
    // So standard iteration works for "Newest on Top".
    
    for (let i = 0; i < visualEchoesRef.current.length; i++) {
        const echo = visualEchoesRef.current[i];
        echo.update();

        if (echo.isDead()) {
            visualEchoesRef.current.splice(i, 1);
            i--; // Adjust index after splice
        } else {
            if (echo.image.complete) {
                ctx.save();
                
                // Center transform for scaling
                ctx.translate(echo.x, echo.y);
                ctx.scale(echo.scale, echo.scale);
                
                ctx.globalAlpha = echo.opacity;
                ctx.globalCompositeOperation = 'multiply'; // Mix blend
                
                // Draw image centered at (0,0) which is mapped to (echo.x, echo.y)
                // Use a fixed aspect ratio sizing or fill screen?
                // Let's keep it roughly screen-sized but scaling down
                const w = echo.width * 0.8; 
                const h = echo.height * 0.8;
                
                ctx.drawImage(echo.image, -w/2, -h/2, w, h);
                
                // Geometric Border
                ctx.strokeStyle = '#D02120';
                ctx.lineWidth = 4;
                ctx.strokeRect(-w/2, -h/2, w, h);

                ctx.restore();
            }
        }
    }

    // --- LAYER 3: Waveform (The Bass) ---
    const data = audioEngine.getWaveformData();
    if (data.length > 0) {
        ctx.save();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#1a1a1a'; 
        ctx.fillStyle = 'rgba(26, 26, 26, 0.1)'; // Slight fill
        ctx.beginPath();

        const sliceWidth = width * 1.0 / data.length;
        let x = 0;

        // Draw centered wave
        for (let i = 0; i < data.length; i++) {
            const v = data[i] / 128.0;
            const y = (v * height / 2); // Spread nicely

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);

            x += sliceWidth;
        }
        
        ctx.stroke();
        ctx.restore();
    }

    // --- LAYER 4: Subtitles (Untertitels) ---
    ctx.save();
    ctx.font = '700 20px "Space Grotesk"';
    ctx.textAlign = 'center';
    
    const text = subtitleRef.current;
    if (text) {
        const textMetrics = ctx.measureText(text);
        const textBgW = textMetrics.width + 40;
        const textBgH = 36;
        const textY = height - 100;

        // Cinema style box
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(width/2 - textBgW/2, textY - textBgH/2 - 5, textBgW, textBgH);
        
        ctx.fillStyle = '#f4f1ea';
        ctx.fillText(text, width/2, textY);
    }
    
    // Loading / Beat indicator
    if (isGeneratingRef.current) {
        ctx.fillStyle = '#D02120';
        ctx.fillRect(0, height - 4, width, 4);
    }
    
    ctx.restore();

    requestAnimationFrame(draw);
  }, [audioEngine]);

  useEffect(() => {
    const frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, [draw]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      <video ref={videoRef} className="hidden" muted playsInline />
      <canvas ref={canvasRef} className="fixed top-0 left-0 w-full h-full z-0" />
    </>
  );
};

export default TechnoCanvas;