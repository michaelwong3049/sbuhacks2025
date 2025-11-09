/**
 * Low-latency DrumKit using the Web Audio API.
 * Pre-generates a short noise buffer for snare hits and plays it immediately.
 */
export class DrumKit {
  private audioCtx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private initialized: boolean = false;

  constructor() {}

  async initialize() {
    if (this.initialized) return;
    this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

    const sr = this.audioCtx.sampleRate;
    const duration = 0.4; // seconds
    const buffer = this.audioCtx.createBuffer(1, Math.floor(sr * duration), sr);
    const data = buffer.getChannelData(0);

    // Fill with decaying white noise to be used as a base for snare/hihat
    for (let i = 0; i < data.length; i++) {
      const env = Math.exp(-i / (sr * 0.06)); // quick decay envelope
      data[i] = (Math.random() * 2 - 1) * env * 0.9;
    }

    this.noiseBuffer = buffer;
    this.initialized = true;
  }

  playSnare() {
    if (!this.initialized || !this.audioCtx || !this.noiseBuffer) {
      // Best-effort initialize if not yet done (caller should call initialize on gesture)
      this.initialize().catch(() => {});
      return;
    }

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // --- noise (rattle) path ---
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = this.noiseBuffer!;
    // short slice for snare
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(1.0, now + 0.005);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    // bandpass to shape the snare "crack"
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 2000;
    band.Q.value = 1.2;

    noiseSrc.connect(band);
    band.connect(noiseGain);

    // --- body oscillator ---
    const bodyOsc = ctx.createOscillator();
    bodyOsc.type = "triangle";
    bodyOsc.frequency.setValueAtTime(180, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(120, now + 0.25);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.0001, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.8, now + 0.01);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    // small highpass on body to avoid mud
    const bodyHP = ctx.createBiquadFilter();
    bodyHP.type = "highpass";
    bodyHP.frequency.value = 100;

    bodyOsc.connect(bodyHP);
    bodyHP.connect(bodyGain);

    // --- transient click ---
    const clickBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.01), ctx.sampleRate);
    const clickData = clickBuf.getChannelData(0);
    for (let i = 0; i < clickData.length; i++) clickData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.002)) * 0.6;
    const clickSrc = ctx.createBufferSource();
    clickSrc.buffer = clickBuf;
    const clickHP = ctx.createBiquadFilter();
    clickHP.type = "highpass";
    clickHP.frequency.value = 2000;
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.001, now);
    clickGain.gain.exponentialRampToValueAtTime(1.0, now + 0.002);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    clickSrc.connect(clickHP);
    clickHP.connect(clickGain);

    // Mix and output through a gentle compressor for glue
    const mix = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 6;
    comp.ratio.value = 6;
    comp.attack.value = 0.005;
    comp.release.value = 0.12;

    noiseGain.connect(mix);
    bodyGain.connect(mix);
    clickGain.connect(mix);

    mix.connect(comp);
    comp.connect(ctx.destination);

    // Start sources
    noiseSrc.start(now);
    noiseSrc.stop(now + 0.2);
    bodyOsc.start(now);
    bodyOsc.stop(now + 0.35);
    clickSrc.start(now);
    clickSrc.stop(now + 0.06);
  }

  playHiHat() {
    if (!this.initialized || !this.audioCtx || !this.noiseBuffer) {
      this.initialize().catch(() => {});
      return;
    }

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Use the pre-created noise buffer but play a very short slice
    const src = ctx.createBufferSource();
    // create a tiny buffer slice to avoid reusing long buffer
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * 0.06);
    const buf = ctx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);
    for (let i = 0; i < len; i++) out[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * 0.01));
    src.buffer = buf;

    // create multiple bandpasses to simulate metallic partials
    const freqs = [7000, 9000, 11000, 13000];
    const master = ctx.createGain();
    // boost master so hi-hat is louder relative to other drums
    master.gain.value = 1.2;

    freqs.forEach((f, i) => {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = f;
      bp.Q.value = 8 + i * 2; // narrower bands for metallic sheen
      const g = ctx.createGain();
      // stagger levels so the top ones are brighter
      g.gain.value = 0.5 + i * 0.2;
      src.connect(bp);
      bp.connect(g);
      g.connect(master);
    });

    // add a tiny highpass click for attack
    const clickBuf = ctx.createBuffer(1, Math.floor(sr * 0.004), sr);
    const clickData = clickBuf.getChannelData(0);
    for (let i = 0; i < clickData.length; i++) clickData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * 0.001)) * 0.6;
    const click = ctx.createBufferSource();
    click.buffer = clickBuf;
    const clickHP = ctx.createBiquadFilter();
    clickHP.type = "highpass";
    clickHP.frequency.value = 5000;
  const clickG = ctx.createGain();
  // stronger click to emphasize attack
  clickG.gain.setValueAtTime(0.02, now);
  clickG.gain.exponentialRampToValueAtTime(1.2, now + 0.002);
  clickG.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
    click.connect(clickHP);
    clickHP.connect(clickG);

    // master envelope
    const finalGain = ctx.createGain();
  finalGain.gain.setValueAtTime(0.0001, now);
  // peak louder for hi-hat
  finalGain.gain.exponentialRampToValueAtTime(1.4, now + 0.002);
  // slightly shorter decay for a snappier hat
  finalGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

  // subtle high-shelf to accentuate brightness
  const shelf = ctx.createBiquadFilter();
  shelf.type = "highshelf";
  shelf.frequency.value = 8000;
  shelf.gain.value = 6;

  master.connect(shelf);
  clickG.connect(shelf);
  shelf.connect(finalGain);
  finalGain.connect(ctx.destination);

    // create a small 'splash' reverb using parallel short delays with feedback
    const reverbMix = ctx.createGain();
    reverbMix.gain.value = 0.45; // how much of the wet/splash goes to the mix

    const delayTimes = [0.02, 0.035, 0.055];
    delayTimes.forEach((dt, i) => {
      const delay = ctx.createDelay();
      delay.delayTime.value = dt + Math.random() * 0.005; // tiny randomization
      const fb = ctx.createGain();
      fb.gain.value = 0.22 - i * 0.04; // decreasing feedback for later taps
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 7000 - i * 800;

      // delay feedback loop: delay -> lp -> fb -> delay
      delay.connect(lp);
      lp.connect(fb);
      fb.connect(delay);

      // feed master into each delay and collect into reverbMix
      master.connect(delay);
      delay.connect(reverbMix);
    });

    // Slight stereo spread so the hat sits slightly right
    const panner = ctx.createStereoPanner();
    panner.pan.value = 0.25;

    src.start(now);
    src.stop(now + 0.12);
    click.start(now);
    click.stop(now + 0.06);

    // final envelope is slightly longer to allow the splash to be audible
    finalGain.gain.setValueAtTime(0.0001, now);
    finalGain.gain.exponentialRampToValueAtTime(1.8, now + 0.002);
    finalGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    // connect reverb mix and dry to final chain
    master.connect(finalGain);
    clickG.connect(finalGain);
    reverbMix.connect(finalGain);
    finalGain.connect(panner);
    panner.connect(ctx.destination);
  }

  playKick() {
    if (!this.initialized || !this.audioCtx) {
      this.initialize().catch(() => {});
      return;
    }

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // transient click for attack
    const sr = ctx.sampleRate;
    const clickBuf = ctx.createBuffer(1, Math.floor(sr * 0.006), sr);
    const clickData = clickBuf.getChannelData(0);
    for (let i = 0; i < clickData.length; i++) clickData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * 0.001)) * 0.8;
    const click = ctx.createBufferSource();
    click.buffer = clickBuf;
    const clickHP = ctx.createBiquadFilter();
    clickHP.type = "highpass";
    clickHP.frequency.value = 1500;
    const clickG = ctx.createGain();
    clickG.gain.setValueAtTime(0.001, now);
    clickG.gain.exponentialRampToValueAtTime(0.9, now + 0.002);
    clickG.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    click.connect(clickHP);
    clickHP.connect(clickG);

    // main low-frequency oscillator with pitch drop
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.35);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.0001, now);
    oscGain.gain.exponentialRampToValueAtTime(1.0, now + 0.02);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

    // lowpass to round the tone
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1200;
    lp.Q.value = 0.6;

    // gentle distortion to add warmth
    const waveShaper = ctx.createWaveShaper();
    // mild curve
    const curve = new Float32Array(65536);
    for (let i = 0; i < curve.length; ++i) {
      const x = (i * 2) / curve.length - 1;
      curve[i] = Math.tanh(x * 2.0);
    }
    waveShaper.curve = curve;
    waveShaper.oversample = "4x";

    osc.connect(oscGain);
    oscGain.connect(lp);
    lp.connect(waveShaper);

    // mix click + body
    const mix = ctx.createGain();
    mix.gain.value = 0.9;
    waveShaper.connect(mix);
    clickG.connect(mix);

    // final output
    mix.connect(ctx.destination);

    click.start(now);
    click.stop(now + 0.06);
    osc.start(now);
    osc.stop(now + 0.6);
  }

  playCrash() {
    if (!this.initialized || !this.audioCtx || !this.noiseBuffer) {
      this.initialize().catch(() => {});
      return;
    }

    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const sr = ctx.sampleRate;

    // Longer noise burst for crash
    const len = Math.floor(sr * 0.18);
    const buf = ctx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);
    for (let i = 0; i < len; i++) out[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * 0.06));

    const src = ctx.createBufferSource();
    src.buffer = buf;

    // wideband metallic shading: many bandpasses
    const freqs = [3000, 5000, 7000, 9000, 11000, 13000];
    const master = ctx.createGain();
    master.gain.value = 1.6; // louder crash

    freqs.forEach((f, i) => {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = f;
      bp.Q.value = 4 + i; // moderate Q for broad metallic tone
      const g = ctx.createGain();
      g.gain.value = 0.4 + i * 0.15;
      src.connect(bp);
      bp.connect(g);
      g.connect(master);
    });

    // big splash: longer delays with gentle feedback
    const reverbMix = ctx.createGain();
    reverbMix.gain.value = 0.6;
    const delayTimes = [0.03, 0.06, 0.11, 0.18];
    delayTimes.forEach((dt, i) => {
      const delay = ctx.createDelay();
      delay.delayTime.value = dt + Math.random() * 0.01;
      const fb = ctx.createGain();
      fb.gain.value = 0.32 - i * 0.06;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 8000 - i * 600;
      delay.connect(lp);
      lp.connect(fb);
      fb.connect(delay);
      master.connect(delay);
      delay.connect(reverbMix);
    });

    // final longer envelope
    const finalGain = ctx.createGain();
    finalGain.gain.setValueAtTime(0.0001, now);
    finalGain.gain.exponentialRampToValueAtTime(1.6, now + 0.01);
    finalGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

    // mild stereo spread left for crash (user requested left crash)
    const panner = ctx.createStereoPanner();
    panner.pan.value = -0.6;

    master.connect(finalGain);
    reverbMix.connect(finalGain);
    finalGain.connect(panner);
    panner.connect(ctx.destination);

    src.start(now);
    src.stop(now + 0.22);
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
      this.noiseBuffer = null;
    this.initialized = false;
  }
}

