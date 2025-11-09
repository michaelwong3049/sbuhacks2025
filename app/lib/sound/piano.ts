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

  // Main synth setup (used as primary or fallback)
  private synth?: Tone.PolySynth;
  private compressor?: Tone.Compressor;
  private filter?: Tone.Filter;
  private reverb?: Tone.Reverb;

  // C4..E5
  private readonly notes = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5"];

  constructor() {
    // Synth will be initialized in initToneFallback when needed
  }

  private async initToneFallback() {
    // Start Tone.js audio context
    await Tone.start();

    // Create a realistic piano sound using FMSynth with multiple effects
    // This configuration mimics the attack, decay, and harmonics of a real piano
    this.synth = new Tone.PolySynth({
      maxPolyphony: 10,
      voice: Tone.FMSynth,
      options: {
        harmonicity: 2.5, // Creates rich harmonics
        modulationIndex: 12, // More complex, piano-like tone
        oscillator: {
          type: "sine", // Carrier wave
        },
        envelope: {
          attack: 0.005, // Very quick attack (piano hammers hit fast)
          decay: 0.25, // Gradual decay like a real piano
          sustain: 0.08, // Low sustain (piano notes decay naturally)
          release: 0.5, // Natural release
        },
        modulation: {
          type: "square", // Modulator for richer harmonics
        },
        modulationEnvelope: {
          attack: 0.008,
          decay: 0.2,
          sustain: 0.15,
          release: 0.35,
        },
      },
    });
    
    // Add compressor for more natural dynamics
    this.compressor = new Tone.Compressor({
      threshold: -24,
      ratio: 4,
      attack: 0.003,
      release: 0.1,
    });
    
    // Add low-pass filter to warm up the sound and remove harsh frequencies
    this.filter = new Tone.Filter({
      type: "lowpass",
      frequency: 2800, // Cut harsh high frequencies
      Q: 0.8, // Gentle rolloff
    });
    
    // Add reverb for realistic room sound
    this.reverb = new Tone.Reverb(0.5); // 0.5 second decay
    await this.reverb.generate(); // Generate reverb impulse
    
    // Connect: synth -> compressor -> filter -> reverb -> destination
    this.synth.connect(this.compressor);
    this.compressor.connect(this.filter);
    this.filter.connect(this.reverb);
    this.reverb.toDestination();

    // Also set up the fallback synths for the layered approach
    this.fallbackStrings = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: {
        attack: 0.02,
        decay: 0.1,
        sustain: 0.3,
        release: 1.2,
      },
    }).toDestination();

    this.fallbackHammer = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: {
        attack: 0.001,
        decay: 0.1,
        sustain: 0,
        release: 0.1,
      },
    }).toDestination();

    this.toneFallback = true;
    console.log("🎹 Piano initialized (Tone.js fallback)");
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

    // Skip soundfont-player for now - use Tone.js synth directly
    // (soundfont-player causes build-time module resolution issues in Next.js)
    // The Tone.js fallback provides good piano sound quality

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

    // Fallback: Use main synth or fallback synths
    if (this.synth) {
      try {
        const vel = Math.max(0.15, Math.min(1, velocity));
        this.synth.triggerAttackRelease(note, "8n", undefined, vel);
      } catch (e) {
        console.error("Failed to play synth note:", e);
      }
    } else if (this.toneFallback && this.fallbackStrings) {
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

      if (this.synth) {
        try {
          this.synth.dispose();
          this.compressor?.dispose();
          this.filter?.dispose();
          this.reverb?.dispose();
        } catch {}
        this.synth = undefined;
        this.compressor = undefined;
        this.filter = undefined;
        this.reverb = undefined;
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

