import * as Tone from "tone";

/**
 * Simple Drum Kit using Tone.js
 * For now, just a snare sound
 */
export class DrumKit {
  private snare: Tone.NoiseSynth;
  private filter: Tone.Filter;
  private initialized: boolean = false;

  constructor() {
    // Create a snare drum using noise with envelope
    this.snare = new Tone.NoiseSynth({
      noise: {
        type: "pink",
      },
      envelope: {
        attack: 0.01,
        decay: 0.2,
        sustain: 0.1,
        release: 0.3,
      },
    });

    // Add a filter to make it sound more like a snare
    this.filter = new Tone.Filter({
      frequency: 8000,
      type: "highpass",
    });

    this.snare.connect(this.filter);
    this.filter.toDestination();
  }

  /**
   * Initialize Tone.js (must be called after user interaction)
   */
  async initialize() {
    if (!this.initialized) {
      await Tone.start();
      this.initialized = true;
    }
  }

  /**
   * Play a snare sound
   */
  async playSnare() {
    if (!this.initialized) {
      await this.initialize();
    }
    this.snare.triggerAttackRelease("8n");
  }

  /**
   * Dispose of the drum kit
   */
  dispose() {
    this.snare.dispose();
    this.filter.dispose();
  }
}

