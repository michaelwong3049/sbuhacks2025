/**
 * Low-latency DrumKit using the Web Audio API.
 * Pre-generates a short noise buffer for snare hits and plays it immediately.
 */
export class DrumKit {
  private audioCtx: AudioContext | null = null;
  private snareBuffer: AudioBuffer | null = null;
  private initialized: boolean = false;

  constructor() {}

  async initialize() {
    if (this.initialized) return;
    this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

    const sr = this.audioCtx.sampleRate;
    const duration = 0.4; // seconds
    const buffer = this.audioCtx.createBuffer(1, Math.floor(sr * duration), sr);
    const data = buffer.getChannelData(0);

    // Fill with decaying white noise to approximate a snare body
    for (let i = 0; i < data.length; i++) {
      const env = Math.exp(-i / (sr * 0.06)); // quick decay envelope
      data[i] = (Math.random() * 2 - 1) * env * 0.8;
    }

    this.snareBuffer = buffer;
    this.initialized = true;
  }

  playSnare() {
    if (!this.initialized || !this.audioCtx || !this.snareBuffer) {
      // Best-effort initialize if not yet done (caller should call initialize on gesture)
      this.initialize().catch(() => {});
      return;
    }

    const ctx = this.audioCtx;
    const src = ctx.createBufferSource();
    src.buffer = this.snareBuffer;

    // Small shaping: bandpass + short gain envelope
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 2000;
    band.Q.value = 0.8;

    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(1.0, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

    src.connect(band);
    band.connect(gain);
    gain.connect(ctx.destination);

    src.start(now);
    src.stop(now + 0.35);
  }

  dispose() {
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch (e) {
        // ignore
      }
      this.audioCtx = null;
    }
    this.snareBuffer = null;
    this.initialized = false;
  }
}

