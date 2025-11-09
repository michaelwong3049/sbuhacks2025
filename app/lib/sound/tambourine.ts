import * as Tone from "tone";

/**
 * Tambourine percussion instrument using Tone.js
 * Generates tambourine jingle sounds using Web Audio API
 */
export class Tambourine {
  private player: Tone.Player | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private initialized: boolean = false;

  constructor() {
    // Audio buffer will be generated on initialization
  }

  /**
   * Initialize Tone.js and generate or load tambourine sound
   */
  async initialize() {
    if (!this.initialized) {
      try {
        await Tone.start();
        
        // Try to load sample first, otherwise generate
        const sampleLoaded = await this.tryLoadSample();
        
        if (!sampleLoaded) {
          // Generate tambourine sound buffer if no sample
          this.generateTambourineBuffer();
          
          // Create Tone.Player from the generated buffer
          if (this.audioBuffer) {
            this.player = new Tone.Player(this.audioBuffer).toDestination();
            this.player.volume.value = -3;
            console.log("🪘 Tambourine initialized with generated sound");
          }
        }
        
        this.initialized = true;
      } catch (error) {
        console.error("Failed to initialize tambourine:", error);
        this.initialized = true;
      }
    }
  }

  /**
   * Try to load a tambourine sample from /public/sounds/
   */
  private async tryLoadSample(): Promise<boolean> {
    try {
      // Try various sample file names
      const sampleUrls = [
        "/sounds/tambourine.mp3",
        "/sounds/ching.mp3",
        "/sounds/tambourine.wav",
        "/sounds/ching.wav",
      ];
      
      for (const url of sampleUrls) {
        try {
          this.player = new Tone.Player({
            url: url,
            autostart: false,
            onload: () => {
              console.log("🪘 Tambourine sample loaded successfully from", url);
            },
            onerror: () => {
              // Try next URL
            },
          }).toDestination();
          
          this.player.volume.value = 0;
          
          // Wait a bit to see if it loads
          await new Promise((resolve) => setTimeout(resolve, 100));
          
          // Check if buffer is loaded
          if (this.player.buffer && this.player.buffer.loaded) {
            return true;
          }
        } catch (error) {
          // Try next URL
          continue;
        }
      }
      
      return false;
    } catch (error) {
      console.log("🪘 Tambourine sample not found, using generated sound");
      return false;
    }
  }

  /**
   * Generate a tambourine jingle sound buffer using Web Audio API
   * Based on the synthesis from tambourine-player.tsx
   */
  private generateTambourineBuffer() {
    const ctx = Tone.context.rawContext as AudioContext;
    const sampleRate = ctx.sampleRate;
    const duration = 0.14; // Short jingle duration
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    // Generate tambourine jingle sound
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      
      // Create metallic jingle using noise and filters
      // High-frequency filtered noise for jingles
      const noise = (Math.random() * 2 - 1) * 0.3;
      
      // Multiple high-frequency components for metallic character
      let sample = 0;
      
      // High-frequency metallic tones (jingles)
      sample += Math.sin(2 * Math.PI * 7000 * t) * Math.exp(-t / 0.016) * 0.4;
      sample += Math.sin(2 * Math.PI * 9000 * t) * Math.exp(-t / 0.014) * 0.3;
      sample += Math.sin(2 * Math.PI * 11000 * t) * Math.exp(-t / 0.012) * 0.2;
      
      // Add filtered noise for jingle texture
      sample += noise * Math.exp(-t / 0.008) * 0.15;
      
      // Apply envelope
      const envelope = Math.exp(-t / 0.02);
      data[i] = sample * envelope * 0.6;
    }

    this.audioBuffer = buffer;
  }

  /**
   * Play the tambourine jingle sound
   */
  play() {
    if (!this.initialized) {
      this.initialize().then(() => {
        this.playSound();
      });
      return;
    }
    
    this.playSound();
  }

  /**
   * Play tambourine sound using Tone.Player
   */
  private playSound() {
    try {
      // Ensure context is running
      if (Tone.context.state !== "running") {
        Tone.start().then(() => {
          this.playSound();
        });
        return;
      }

      // Play the tambourine buffer
      if (this.player) {
        this.player.start();
      } else if (this.audioBuffer) {
        // Fallback: play buffer directly
        const ctx = Tone.context.rawContext as AudioContext;
        const source = ctx.createBufferSource();
        source.buffer = this.audioBuffer;
        source.connect(ctx.destination);
        source.start(0);
      }
    } catch (error) {
      console.error("Failed to play tambourine:", error);
    }
  }

  /**
   * Dispose of the tambourine and clean up Tone.js resources
   */
  dispose() {
    try {
      if (this.player) {
        this.player.dispose();
        this.player = null;
      }
      this.audioBuffer = null;
    } catch (error) {
      console.error("Error disposing tambourine:", error);
    }
    this.initialized = false;
  }
}

