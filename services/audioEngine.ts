import { Note, NOTES } from '../types';

type NoteCallback = (note: Note, type: 'SYNTH' | 'DETECTED') => void;

export class AudioEngine {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private microphoneStream: MediaStream | null = null;
  private microphoneSource: MediaStreamAudioSourceNode | null = null;
  
  // Sequencer state
  private isPlaying = false;
  private nextNoteTime = 0;
  private current16thNote = 0;
  private tempo = 132; // Faster Techno
  private lookahead = 25.0;
  private scheduleAheadTime = 0.1;
  private timerID: number | null = null;
  
  // Callbacks
  private onNoteTrigger: NoteCallback | null = null;

  // Waveform data
  public dataArray: Uint8Array | null = null;

  constructor() {}

  public setNoteCallback(callback: NoteCallback) {
    this.onNoteTrigger = callback;
  }

  public async init() {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.context = new AudioContextClass();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 2048; 
    this.analyser.smoothingTimeConstant = 0.85;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    
    this.gainNode = this.context.createGain();
    this.gainNode.gain.value = 0.6;
    this.gainNode.connect(this.context.destination);

    // Get Microphone
    try {
      this.microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.microphoneSource = this.context.createMediaStreamSource(this.microphoneStream);
      this.microphoneSource.connect(this.analyser);
    } catch (e) {
      console.warn("Microphone access denied, visualization will only use synth.");
    }
  }

  public start() {
    if (!this.context) return;
    if (this.context.state === 'suspended') {
      this.context.resume();
    }
    this.isPlaying = true;
    this.current16thNote = 0;
    this.nextNoteTime = this.context.currentTime;
    this.scheduler();
  }

  public stop() {
    this.isPlaying = false;
    if (this.timerID) window.clearTimeout(this.timerID);
  }

  private scheduler() {
    if (!this.context) return;
    while (this.nextNoteTime < this.context.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.current16thNote, this.nextNoteTime);
      this.nextStep();
    }
    if (this.isPlaying) {
      this.timerID = window.setTimeout(() => this.scheduler(), this.lookahead);
    }
  }

  private nextStep() {
    const secondsPerBeat = 60.0 / this.tempo;
    this.nextNoteTime += 0.25 * secondsPerBeat;
    this.current16thNote++;
    if (this.current16thNote === 16) {
      this.current16thNote = 0;
    }
  }

  private scheduleNote(beatNumber: number, time: number) {
    if (!this.context || !this.gainNode) return;

    // Trigger callbacks slightly in the future to match audio, 
    // but for visuals, immediate feedback is often okay. 
    // We'll trigger the callback now for simplicity in the loop.

    // KICK (0, 4, 8, 12) - Fixed Low C
    if (beatNumber % 4 === 0) {
      this.playKick(time);
      this.triggerVisual(Note.C, 'SYNTH'); 
    }

    // BASS (Offbeat: 2, 6, 10, 14)
    if (beatNumber % 4 === 2) {
        const freqs = [55, 110]; // A1, A2
        const freq = freqs[Math.floor(Math.random() * freqs.length)];
        const note = this.frequencyToNote(freq).note;
        
        this.playBass(time, freq);
        this.triggerVisual(note, 'SYNTH');
    }

    // HI-HAT (Odd)
    if (beatNumber % 2 !== 0) {
        this.playHiHat(time);
        if (beatNumber % 4 !== 0) {
             // Add a syncopated trigger
             this.triggerVisual(Note.Fs, 'SYNTH'); // F# often feels metallic/high
        }
    }
  }

  private triggerVisual(note: Note, type: 'SYNTH' | 'DETECTED') {
      if (this.onNoteTrigger) {
          // Use setTimeout to align closer to actual audio time if needed, 
          // but keeping it direct for responsiveness
          this.onNoteTrigger(note, type);
      }
  }

  private playKick(time: number) {
      if (!this.context || !this.analyser) return;
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.connect(gain);
      gain.connect(this.analyser); // Visuals
      gain.connect(this.gainNode!); // Audio Output

      osc.frequency.setValueAtTime(150, time);
      osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
      gain.gain.setValueAtTime(1, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

      osc.start(time);
      osc.stop(time + 0.5);
  }

  private playBass(time: number, freq: number) {
      if (!this.context || !this.analyser) return;
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = 'sawtooth'; 
      osc.connect(gain);
      gain.connect(this.analyser);
      gain.connect(this.gainNode!);

      osc.frequency.setValueAtTime(freq, time);
      osc.frequency.linearRampToValueAtTime(freq - 10, time + 0.2);
      
      gain.gain.setValueAtTime(0.6, time);
      gain.gain.linearRampToValueAtTime(0.01, time + 0.3);

      osc.start(time);
      osc.stop(time + 0.3);
  }

  private playHiHat(time: number) {
      if (!this.context || !this.analyser) return;
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = 'square';
      osc.connect(gain);
      gain.connect(this.analyser);
      gain.connect(this.gainNode!);

      osc.frequency.setValueAtTime(800, time);
      gain.gain.setValueAtTime(0.1, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
      osc.start(time);
      osc.stop(time + 0.05);
  }

  public getWaveformData(): Uint8Array {
    if (this.analyser && this.dataArray) {
      this.analyser.getByteTimeDomainData(this.dataArray);
      return this.dataArray;
    }
    return new Uint8Array(0);
  }

  // AutoCorrelation Pitch Detection
  public getPitch(): { note: Note, frequency: number } {
    if (!this.analyser || !this.context) return { note: Note.SILENCE, frequency: 0 };

    const buffer = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buffer);
    const sampleRate = this.context.sampleRate;
    
    // Simple RMS check
    let rms = 0;
    for (let i=0; i<buffer.length; i++) {
        rms += buffer[i]*buffer[i];
    }
    rms = Math.sqrt(rms/buffer.length);
    if (rms < 0.015) return { note: Note.SILENCE, frequency: 0 }; // Higher threshold to ignore silence

    const SIZE = buffer.length;
    let best_offset = -1;
    let best_correlation = 0;
    let foundGoodCorrelation = false;
    let correlations = new Array(SIZE).fill(0);

    for (let offset = 0; offset < SIZE; offset++) {
        let correlation = 0;
        for (let i=0; i<SIZE; i++) {
            correlation += Math.abs((buffer[i]) - (buffer[i+offset]));
        }
        correlation = 1 - (correlation/SIZE);
        correlations[offset] = correlation; 
        if ((correlation > 0.9) && (correlation > best_correlation)) {
            foundGoodCorrelation = true;
            if (correlation > best_correlation) {
                best_correlation = correlation;
                best_offset = offset;
            }
        } else if (foundGoodCorrelation) {
            let shift = (correlations[best_offset+1] - correlations[best_offset-1]) / (2 * (2 * correlations[best_offset] - correlations[best_offset+1] - correlations[best_offset-1]));
            let f = sampleRate / (best_offset + (8 * shift));
            return this.frequencyToNote(f);
        }
    }

    if (best_correlation > 0.01) {
       let f = sampleRate / best_offset;
       return this.frequencyToNote(f);
    }

    return { note: Note.SILENCE, frequency: 0 };
  }

  private frequencyToNote(frequency: number): { note: Note, frequency: number } {
    // Handle limits
    if (frequency === 0 || !isFinite(frequency)) return { note: Note.SILENCE, frequency: 0 };
    const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
    const midi = Math.round(noteNum) + 69;
    const note = NOTES[midi % 12];
    return { note: (note as Note) || Note.SILENCE, frequency };
  }
}