export enum Note {
  C = "C",
  Cs = "C#",
  D = "D",
  Ds = "D#",
  E = "E",
  F = "F",
  Fs = "F#",
  G = "G",
  Gs = "G#",
  A = "A",
  As = "A#",
  B = "B",
  SILENCE = "..."
}

export interface AudioState {
  isPlaying: boolean;
  currentPitch: number;
  currentNote: Note;
  volume: number;
}

export interface ImageMap {
  [key: string]: string; // Note -> Base64/URL
}

export const NOTES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"
];

export type VisualMode = 'CAMERA' | 'GENERATED' | 'MIX';