import * as Tone from "tone";

/**
 * Piano using Tone.js with enhanced synthesis for realistic piano sounds
 * Uses FMSynth with carefully tuned parameters to mimic a real piano
 */
export class Piano {
  private synth: Tone.PolySynth<Tone.FMSynth>;
  private filter: Tone.Filter;
  private reverb: Tone.Reverb;
  private compressor: Tone.Compressor;
  private initialized: boolean = false;
  
  // Piano notes (extended: C4 to E5)
  private readonly notes = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5"];

  constructor() {
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
    // Tone.Reverb constructor takes decay time in seconds, not an options object
    this.reverb = new Tone.Reverb(0.5); // 0.5 seconds decay
    
    // Connect: synth -> compressor -> filter -> reverb -> destination
    this.synth.connect(this.compressor);
    this.compressor.connect(this.filter);
    this.filter.connect(this.reverb);
    this.reverb.toDestination();
  }

  /**
   * Initialize Tone.js (must be called after user interaction)
   */
  async initialize() {
    if (!this.initialized) {
      try {
        await Tone.start();
        // Initialize reverb (generates impulse response)
        await this.reverb.generate();
        console.log("🎹 Piano initialized - Enhanced synthesized piano sound ready!");
        this.initialized = true;
      } catch (error) {
        console.error("Failed to initialize piano:", error);
      }
    }
  }

  /**
   * Play a piano note
   * @param noteIndex - Index of the note (0-9 for C4 to E5)
   */
  playNote(noteIndex: number) {
    if (noteIndex < 0 || noteIndex >= this.notes.length) {
      console.warn(`Invalid note index: ${noteIndex}`);
      return;
    }
    
    const note = this.notes[noteIndex];
    
    // Ensure Tone.js is initialized
    if (!this.initialized) {
      console.log("🎹 Piano not initialized, initializing now...");
      this.initialize().then(() => {
        this.triggerNote(note);
      }).catch((error) => {
        console.error("Failed to initialize piano:", error);
      });
      return;
    }
    
    this.triggerNote(note);
  }

  /**
   * Actually trigger the note
   */
  private triggerNote(note: string) {
    try {
      // Use synthesized piano sound with realistic attack and release
      // "8n" = eighth note duration, gives a nice piano-like note
      this.synth.triggerAttackRelease(note, "8n");
      console.log(`🎹 Playing note: ${note}`);
    } catch (error) {
      console.error(`Failed to play note ${note}:`, error);
    }
  }

  /**
   * Get all available notes
   */
  getNotes(): string[] {
    return [...this.notes];
  }

  /**
   * Dispose of the piano
   */
  dispose() {
    if (this.synth) {
      this.synth.dispose();
    }
    if (this.compressor) {
      this.compressor.dispose();
    }
    if (this.filter) {
      this.filter.dispose();
    }
    if (this.reverb) {
      this.reverb.dispose();
    }
  }
}

