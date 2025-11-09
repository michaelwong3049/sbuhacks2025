import * as Tone from "tone";

/**
 * Triangle percussion instrument using Tone.js
 * Generates a realistic triangle sound using Web Audio API and plays it with Tone.Player
 */
export class Triangle {
  private player: Tone.Player | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private initialized: boolean = false;

  constructor() {
    // Audio buffer will be generated on initialization
  }

  /**
   * Initialize Tone.js and generate or load triangle sound
   */
  async initialize() {
    if (!this.initialized) {
      try {
        await Tone.start();
        
        // Try to load sample first, otherwise generate
        const sampleLoaded = await this.tryLoadSample();
        
        if (!sampleLoaded) {
          // Generate triangle sound buffer if no sample
          this.generateTriangleBuffer();
          
          // Create Tone.Player from the generated buffer
          if (this.audioBuffer) {
            this.player = new Tone.Player(this.audioBuffer).toDestination();
            this.player.volume.value = -3;
            console.log("🔺 Triangle initialized with generated sound");
          }
        }
        
        this.initialized = true;
      } catch (error) {
        console.error("Failed to initialize triangle:", error);
        this.initialized = true;
      }
    }
  }

  /**
   * Try to load a triangle sample from /public/sounds/
   */
  private async tryLoadSample(): Promise<boolean> {
    try {
      // Try MP3 first, then WAV
      const sampleUrl = "/sounds/triangle.mp3";
      
      this.player = new Tone.Player({
        url: sampleUrl,
        autostart: false,
        onload: () => {
          console.log("🔺 Triangle sample loaded successfully!");
        },
        onerror: () => {
          // Try WAV if MP3 fails
          this.tryLoadWavSample();
        },
      }).toDestination();
      
      this.player.volume.value = 0;
      
      // Wait a bit to see if it loads
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      // Check if buffer is loaded
      if (this.player.buffer && this.player.buffer.loaded) {
        return true;
      }
      
      // If MP3 didn't work, try WAV
      return await this.tryLoadWavSample();
    } catch (error) {
      console.log("🔺 Triangle sample not found, using generated sound");
      return false;
    }
  }

  /**
   * Try to load WAV sample
   */
  private async tryLoadWavSample(): Promise<boolean> {
    try {
      this.player = new Tone.Player({
        url: "/sounds/triangle.wav",
        autostart: false,
      }).toDestination();
      
      this.player.volume.value = 0;
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      if (this.player.buffer && this.player.buffer.loaded) {
        return true;
      }
    } catch (error) {
      // Sample not found, will use generated sound
    }
    return false;
  }

  /**
   * Generate a high-quality triangle sound buffer using advanced synthesis
   */
  private generateTriangleBuffer() {
    const ctx = Tone.context.rawContext as AudioContext;
    const sampleRate = ctx.sampleRate;
    const duration = 4.0; // 4 seconds for full ring
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    // Triangle fundamental frequency (slightly higher for brightness)
    const freq = 1047; // C6 - brighter than A5
    
    // Generate triangle sound with realistic characteristics
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      
      // Dual decay envelope (fast initial, slow tail)
      const fastDecay = Math.exp(-t * 3.0);
      const slowDecay = Math.exp(-t * 0.8);
      const envelope = fastDecay * 0.3 + slowDecay * 0.7;
      
      let sample = 0;
      
      // Fundamental tone - main body of sound
      sample += Math.sin(2 * Math.PI * freq * t) * 0.6;
      
      // Strong odd harmonics (3rd, 5th, 7th, 9th) - triangle characteristic
      const harmonic3 = Math.sin(2 * Math.PI * freq * 3 * t) * 0.25;
      const harmonic5 = Math.sin(2 * Math.PI * freq * 5 * t) * 0.12;
      const harmonic7 = Math.sin(2 * Math.PI * freq * 7 * t) * 0.06;
      const harmonic9 = Math.sin(2 * Math.PI * freq * 9 * t) * 0.03;
      
      // Harmonics decay at different rates
      sample += harmonic3 * Math.exp(-t * 2.5);
      sample += harmonic5 * Math.exp(-t * 3.5);
      sample += harmonic7 * Math.exp(-t * 4.5);
      sample += harmonic9 * Math.exp(-t * 5.5);
      
      // High frequency components for brightness and attack
      if (t < 0.015) {
        const attackEnv = 1 - (t / 0.015);
        // Multiple high frequencies for complex attack
        sample += Math.sin(2 * Math.PI * freq * 12 * t) * 0.25 * attackEnv;
        sample += Math.sin(2 * Math.PI * freq * 16 * t) * 0.15 * attackEnv;
        sample += Math.sin(2 * Math.PI * freq * 20 * t) * 0.1 * attackEnv;
      }
      
      // Inharmonic partials for metallic character
      sample += Math.sin(2 * Math.PI * freq * 2.3 * t) * 0.1 * Math.exp(-t * 2.8);
      sample += Math.sin(2 * Math.PI * freq * 4.1 * t) * 0.08 * Math.exp(-t * 3.2);
      
      // Apply overall envelope
      data[i] = sample * envelope * 0.5;
    }

    this.audioBuffer = buffer;
  }

  /**
   * Play the triangle sound
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
   * Play triangle sound using Tone.Player
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

      // Play the triangle buffer
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
      console.error("Failed to play triangle:", error);
    }
  }

  /**
   * Dispose of the triangle and clean up Tone.js resources
   */
  dispose() {
    try {
      if (this.player) {
        this.player.dispose();
        this.player = null;
      }
      this.audioBuffer = null;
    } catch (error) {
      console.error("Error disposing triangle:", error);
    }
    this.initialized = false;
  }
}

