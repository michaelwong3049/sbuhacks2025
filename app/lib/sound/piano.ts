/* eslint-disable @typescript-eslint/ban-ts-comment */
import * as Tone from "tone";

/**
 * Piano that prefers sampled playback via soundfont-player when available,
 * but gracefully falls back to a Tone.js layered synth if the module is not
 * installed or fails to load. This prevents build-time resolution errors in
 * environments where the dependency hasn't been installed.
 */
export class Piano {
  private audioCtx: AudioContext | null = null;
  private player: any = null; // soundfont-player instrument when available
  private initialized = false;

  // Fallback Tone.js synthesizers
  private toneFallback = false;
  private fallbackStrings?: Tone.PolySynth;
  private fallbackHammer?: Tone.NoiseSynth;

  // C4..E5
  private readonly notes = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5"];

  constructor() {}

  private async initToneFallback() {
    // Initialize a small layered Tone.js piano as a fallback
    await Tone.start();
    this.fallbackStrings = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.002, decay: 1.6, sustain: 0.06, release: 1.2 },
      volume: -6,
    }).toDestination();

    this.fallbackHammer = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.0006, decay: 0.05, sustain: 0 }, volume: -8 }).toDestination();
    this.toneFallback = true;
    console.log("🎹 Piano: using Tone.js fallback synth");
  }

  async initialize() {
    if (this.initialized) return;

    // Ensure AudioContext exists (some browsers require user gesture)
    this.audioCtx = this.audioCtx || new (window.AudioContext || (window as any).webkitAudioContext)();
    if (this.audioCtx.state === "suspended") {
      try {
        await this.audioCtx.resume();
      } catch (e) {
        // ignore
      }
    }

    // Attempt to dynamically import soundfont-player at runtime.
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Soundfont = await import("soundfont-player");
      // If import succeeded, try to create instrument
      try {
        this.player = await Soundfont.instrument(this.audioCtx, "acoustic_grand_piano", { gain: 1 });
        this.initialized = true;
        console.log("🎹 Piano initialized (soundfont-player) - acoustic_grand_piano ready");
        return;
      } catch (err) {
        console.warn("soundfont-player loaded but failed to create instrument:", err);
        // fall through to Tone fallback
      }
    } catch (err) {
      // Module not found or dynamic import failed — fall back to Tone.js synth
      console.warn("soundfont-player not available, falling back to Tone.js synth:", err && err.message ? err.message : err);
    }

    // Tone fallback
    try {
      await this.initToneFallback();
      this.initialized = true;
    } catch (e) {
      console.error("Failed to initialize fallback Tone.js piano:", e);
    }
  }

  playNote(noteIndex: number, velocity: number = 1) {
    if (noteIndex < 0 || noteIndex >= this.notes.length) {
      console.warn(`Invalid note index: ${noteIndex}`);
      return;
    }

    const note = this.notes[noteIndex];

    if (!this.initialized) {
      this.initialize().then(() => this.playNote(noteIndex, velocity)).catch((e) => console.error(e));
      return;
    }

    // If sampled player is available, use it
    if (this.player && typeof this.player.play === "function") {
      try {
        const gain = Math.max(0.15, Math.min(1.2, velocity));
        this.player.play(note, 0, { gain });
        return;
      } catch (e) {
        console.warn("soundfont-player failed to play, falling back to synth:", e);
      }
    }

    // Fallback: Tone.js synth layers
    if (this.toneFallback && this.fallbackStrings) {
      try {
        const vel = Math.max(0.15, Math.min(1, velocity));
        this.fallbackHammer?.triggerAttackRelease("32n", undefined, vel * 0.6);
        this.fallbackStrings.triggerAttackRelease(note, 1.6, undefined, vel);
      } catch (e) {
        console.error("Failed to play fallback synth note:", e);
      }
    }
  }

  getNotes(): string[] {
    return [...this.notes];
  }

  async dispose() {
    try {
      // Dispose player if it has a stop/close method
      if (this.player && typeof this.player.stop === "function") {
        try { this.player.stop(); } catch {}
        this.player = null;
      }

      if (this.toneFallback) {
        try {
          this.fallbackStrings?.dispose();
          this.fallbackHammer?.dispose();
        } catch {}
        this.toneFallback = false;
      }

      if (this.audioCtx) {
        try { await this.audioCtx.close(); } catch {}
        this.audioCtx = null;
      }
      this.initialized = false;
    } catch (e) {
      console.warn("Error disposing piano resources:", e);
    }
  }
}

