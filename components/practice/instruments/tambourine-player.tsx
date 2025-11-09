"use client";

import React, { useEffect, useRef, useState } from "react";
import TambourineCalibration from "@/components/calibration/TambourineCalibration";

type HandsType = {
  setOptions: (options: any) => void;
  onResults: (callback: (results: any) => void) => void;
  send: (data: { image: HTMLVideoElement }) => Promise<void>;
  close: () => Promise<void>;
};

import { PeerManager } from "@/app/lib/webrtc/peer-manager";

interface TambourinePlayerProps {
  peerManager?: PeerManager | null;
}

export default function TambourinePlayer({
  peerManager = null,
}: TambourinePlayerProps = {}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [handPositions, setHandPositions] = useState<{
    left?: { x: number; y: number };
    right?: { x: number; y: number };
  }>({});
  const handsRef = useRef<HandsType | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  // Use a local WebAudio context for tambourine playback (do NOT use drum-kit.ts)
  const audioCtxRef = useRef<AudioContext | null>(null);

  // velocity threshold (px/s) for tambourine "shake" -> trigger jingles
  const [velocityThreshold, setVelocityThreshold] = useState<number>(1200);
  const previousPositionsRef = useRef<
    Map<number, { x: number; y: number; timestamp: number }>
  >(new Map());
  const previousWristPositionsRef = useRef<
    Map<number, { x: number; y: number; timestamp: number }>
  >(new Map());
  const lastTriggerRef = useRef<Map<number, number>>(new Map()); // per-hand cooldown
  const previousSpeedRef = useRef<Map<number, number>>(new Map());
  const shakeIntervalRef = useRef<Map<number, number>>(new Map());
  // track active audio sources so we can stop them when hands disappear / camera stops
  const activeSourcesRef = useRef<Set<any>>(new Set());
  const chingPlayingRef = useRef<boolean>(false);
  const oneshotPlayingRef = useRef<boolean>(false);
  const lastHitRef = useRef<number>(0);
  const COOLDOWN_MS = 180;
  // Lowered thresholds so lighter motions are recognized on more devices
  const SLAP_ACCEL_THRESHOLD = 2000; // px/s^2 (tunable)
  const SLAP_COOLDOWN = 300; // ms
  const SHAKE_SPEED_THRESHOLD = 400; // px/s -> start shake
  const SHAKE_STOP_THRESHOLD = 300; // px/s -> stop shake
  const HIT_DISTANCE_PX = 80;
  const HIT_SPEED_THRESHOLD = 450;
  const HIT_COOLDOWN_MS = 300;

  const computeCurl = (landmarks: any[]) => {
    if (!landmarks || landmarks.length < 21) return 0;
    const wrist = landmarks[0];
    const mid = landmarks[9];
    const handSize = Math.hypot(mid.x - wrist.x, mid.y - wrist.y) || 1;
    const tips = [8, 12, 16, 20];
    let sum = 0;
    for (const t of tips) {
      const d = Math.hypot(landmarks[t].x - wrist.x, landmarks[t].y - wrist.y);
      sum += d;
    }
    const avg = sum / tips.length;
    return avg / handSize;
  };

  useEffect(() => {
    // audio context will be created on first gesture (startCamera/test jingle)
    if (!videoRef.current || !canvasRef.current) return;

    const initHands = () => {
      const checkAndInit = () => {
        const Hands = (window as any).Hands;

        if (!Hands) {
          const script = document.createElement("script");
          script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";
          script.crossOrigin = "anonymous";
          script.onload = () => {
            const HandsClass = (window as any).Hands;
            if (HandsClass) initializeHands(HandsClass);
          };
          script.onerror = () =>
            console.error("Failed to load MediaPipe Hands script");
          document.head.appendChild(script);
        } else {
          initializeHands(Hands);
        }
      };

      const initializeHands = (Hands: any) => {
        try {
          const hands = new Hands({
            locateFile: (file: string) =>
              `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
          });

          console.info(
            "tambourine: initializeHands() - MediaPipe Hands class instantiated"
          );

          hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });

          hands.onResults(async (results: any) => {
            // quick debug: confirm that onResults is being called and how many hands
            try {
              console.info(
                "tambourine: hands.onResults called; hands=",
                results?.multiHandLandmarks?.length ?? 0
              );
            } catch (e) {
              /* ignore logging errors */
            }
            const canvas = canvasRef.current;
            const video = videoRef.current;
            if (!canvas || !video) return;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            const w = canvas.width;
            const h = canvas.height;

            // Draw mirrored camera for natural user view
            ctx.save();
            ctx.clearRect(0, 0, w, h);
            ctx.translate(w, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(results.image, 0, 0, w, h);
            ctx.restore();

            // Draw landmarks mirrored for readability
            if (results.multiHandLandmarks) {
              for (const landmarks of results.multiHandLandmarks) {
                for (const lm of landmarks) {
                  const px = Math.round((1 - (lm.x ?? 0)) * w);
                  const py = Math.round((lm.y ?? 0) * h);
                  ctx.beginPath();
                  ctx.fillStyle = "#fff";
                  ctx.arc(px, py, 3, 0, Math.PI * 2);
                  ctx.fill();
                }
              }
            }

            // Velocity/shake detection uses index-tip (landmark 8) visual coordinates
            if (
              results.multiHandLandmarks &&
              results.multiHandLandmarks.length > 0
            ) {
              // Track which hands were present this frame so we can stop any
              // lingering shake intervals for hands that disappeared.
              const presentHands = new Set<number>();
              const now = performance.now();

              // compute curl for each hand up-front so we can decide whether a
              // particular hand is an open hand or a fist. Open hands should
              // remain silent except when they meet the other hand (hit).
              const curls: number[] = results.multiHandLandmarks.map(
                (lm: any[]) => computeCurl(lm)
              );

              results.multiHandLandmarks.forEach(
                (landmarks: any[], handIndex: number) => {
                  presentHands.add(handIndex);
                  const lm = landmarks[8]; // index tip
                  const wristLm = landmarks[0];
                  if (!lm || !wristLm) return;

                  const visual = {
                    x: Math.round((1 - lm.x) * w),
                    y: Math.round(lm.y * h),
                  };
                  const wristVisual = {
                    x: Math.round((1 - wristLm.x) * w),
                    y: Math.round(wristLm.y * h),
                  };
                  const curl = curls[handIndex] || 0;
                  const isOpenHand = curl > 0.55;
                  const isFist = curl < 0.38;
                  const prev = previousPositionsRef.current.get(handIndex);
                  const prevSpeed =
                    previousSpeedRef.current.get(handIndex) || 0;
                  let speed = 0;
                  if (prev) {
                    const dt = Math.max((now - prev.timestamp) / 1000, 1e-6);
                    const dx = visual.x - prev.x;
                    const dy = visual.y - prev.y;
                    const indexSpeed = Math.hypot(dx, dy) / dt; // px/s

                    // compute wrist speed as well and prefer whichever is larger
                    const prevW =
                      previousWristPositionsRef.current.get(handIndex);
                    let wristSpeed = 0;
                    if (prevW) {
                      const dtW = Math.max(
                        (now - prevW.timestamp) / 1000,
                        1e-6
                      );
                      const dxW = wristVisual.x - prevW.x;
                      const dyW = wristVisual.y - prevW.y;
                      wristSpeed = Math.hypot(dxW, dyW) / dtW;
                    }
                    speed = Math.max(indexSpeed, wristSpeed);

                    const accel = (speed - prevSpeed) / dt; // px/s^2
                    const last = lastTriggerRef.current.get(handIndex) || 0;

                    // Only allow per-hand audio from non-open hands. Hands that
                    // are definitely open (isOpen) remain silent; ambiguous
                    // hands (not strictly a fist) are allowed to produce ching
                    // or shake so the user still hears feedback.
                    if (!isOpenHand) {
                      // Detect a sharp strike (large positive acceleration)
                      if (
                        accel > SLAP_ACCEL_THRESHOLD &&
                        now - last > SLAP_COOLDOWN
                      ) {
                        console.info("tambourine: strong strike detected", {
                          handIndex,
                          speed,
                          accel,
                        });
                        // Strong single-hand strike -> ching (not a two-hand slap)
                        playJingle("ching", Math.min(1, speed / 3000));
                        lastTriggerRef.current.set(handIndex, now);
                        
                        // Send sound event to peers if peerManager is available
                        if (peerManager) {
                          try {
                            console.log('📤 Sending tambourine sound event to peers:', { type: 'tambourine' });
                            peerManager.sendSoundEvent({
                              type: 'tambourine',
                            });
                            console.log('✅ Tambourine sound event sent successfully');
                          } catch (error) {
                            console.error('❌ Failed to send tambourine sound event:', error);
                          }
                        }

                        // quick flash for strong strike
                        ctx.beginPath();
                        ctx.strokeStyle = "rgba(255, 120, 20, 0.95)";
                        ctx.lineWidth = 6;
                        ctx.arc(visual.x, visual.y, 32, 0, Math.PI * 2);
                        ctx.stroke();
                      } else {
                        // Shake detection: sustained high speed -> start a repeating jingle
                        const shakeIntervalExists =
                          shakeIntervalRef.current.get(handIndex) !== undefined;
                        if (speed > SHAKE_SPEED_THRESHOLD) {
                          if (!shakeIntervalExists) {
                            // start repeating shimmer based on speed
                            const intervalMs = Math.max(
                              35,
                              240 - Math.min(200, Math.round(speed / 12))
                            );
                            console.info("tambourine: shake started", {
                              handIndex,
                              speed,
                              intervalMs,
                            });
                            const id = window.setInterval(() => {
                              // repeated micro-shake bursts produce "shaka-shaka"
                              playShakeBurst(Math.min(1, speed / 2500));
                            }, intervalMs) as unknown as number;
                            shakeIntervalRef.current.set(handIndex, id);
                          }
                        } else if (speed < SHAKE_STOP_THRESHOLD) {
                          // stop shaking
                          const id = shakeIntervalRef.current.get(handIndex);
                          if (id !== undefined) {
                            clearInterval(id);
                            shakeIntervalRef.current.delete(handIndex);
                            console.info("tambourine: shake stopped", {
                              handIndex,
                            });
                          }
                        }
                      }
                    } else {
                      // ensure open hands do not hold active shake intervals
                      const id = shakeIntervalRef.current.get(handIndex);
                      if (id !== undefined) {
                        clearInterval(id);
                        shakeIntervalRef.current.delete(handIndex);
                      }
                    }
                  }

                  // Visual flash on single jingle triggers (already done), otherwise small marker
                  if (!prev) {
                    ctx.beginPath();
                    ctx.fillStyle = "rgba(255,255,255,0.06)";
                    ctx.arc(visual.x, visual.y, 6, 0, Math.PI * 2);
                    ctx.fill();
                  }

                  previousPositionsRef.current.set(handIndex, {
                    x: visual.x,
                    y: visual.y,
                    timestamp: now,
                  });
                  previousWristPositionsRef.current.set(handIndex, {
                    x: wristVisual.x,
                    y: wristVisual.y,
                    timestamp: now,
                  });
                  previousSpeedRef.current.set(handIndex, speed);
                }
              );

              // If any hand that previously had a shake interval is no longer
              // present, clear its interval so the tambourine stops.
              try {
                const toClear: number[] = [];
                shakeIntervalRef.current.forEach((id, handIdx) => {
                  if (!presentHands.has(handIdx)) toClear.push(handIdx);
                });
                toClear.forEach((handIdx) => {
                  const id = shakeIntervalRef.current.get(handIdx);
                  if (id !== undefined) {
                    clearInterval(id);
                    shakeIntervalRef.current.delete(handIdx);
                    // also clear last trigger to avoid immediate re-trigger on
                    // re-appearance without new motion
                    lastTriggerRef.current.delete(handIdx);
                    // clear wrist/index history for disappeared hands
                    try {
                      previousPositionsRef.current.delete(handIdx);
                      previousWristPositionsRef.current.delete(handIdx);
                      previousSpeedRef.current.delete(handIdx);
                    } catch (e) {
                      /* ignore */
                    }
                  }
                });
              } catch (e) {
                // ignore
              }

              // Additional gesture logic: if we can identify one hand as a
              // fist (holding tambourine) and the other as open, trigger
              // ching on fist shake and a oneshot when open hand hits fist.
              try {
                const now2 = performance.now();
                if (
                  results.multiHandLandmarks &&
                  results.multiHandLandmarks.length > 0
                ) {
                  const entries: { idx: number; curl: number }[] = [];
                  for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                    const lm = results.multiHandLandmarks[i];
                    entries.push({ idx: i, curl: computeCurl(lm) });
                  }
                  entries.sort((a, b) => a.curl - b.curl);
                  const fistCandidate = entries[0];
                  const openCandidate =
                    entries.length > 1 ? entries[entries.length - 1] : null;
                  let fistIdx: number | null = null;
                  let openIdx: number | null = null;
                  // Prefer strong curl thresholds, but if there are exactly two
                  // hands present, fall back to assigning the lower-curl as the
                  // fist and the higher-curl as the open hand so slap detection
                  // still works when curls are ambiguous.
                  if (fistCandidate && fistCandidate.curl < 0.42) {
                    fistIdx = fistCandidate.idx;
                  }
                  if (openCandidate && openCandidate.curl > 0.5) {
                    openIdx = openCandidate.idx;
                  }
                  if (
                    entries.length === 2 &&
                    (fistIdx === null || openIdx === null)
                  ) {
                    // fallback assignment
                    fistIdx = entries[0].idx;
                    openIdx = entries[1].idx;
                  }

                  // fist shake -> ching sample
                  if (fistIdx !== null) {
                    const speed = previousSpeedRef.current.get(fistIdx) || 0;
                    const last = lastTriggerRef.current.get(fistIdx) || 0;
                    if (
                      speed > SHAKE_SPEED_THRESHOLD &&
                      now2 - last > COOLDOWN_MS
                    ) {
                      console.info("tambourine: fist shake detected", {
                        fistIdx,
                        speed,
                      });
                      // prefer ching sample
                      playJingle("ching", Math.min(1, speed / 3000));
                      lastTriggerRef.current.set(fistIdx, now2);
                      
                      // Send sound event to peers if peerManager is available
                      if (peerManager) {
                        try {
                          console.log('📤 Sending tambourine sound event to peers (fist shake):', { type: 'tambourine' });
                          peerManager.sendSoundEvent({
                            type: 'tambourine',
                          });
                          console.log('✅ Tambourine sound event sent successfully');
                        } catch (error) {
                          console.error('❌ Failed to send tambourine sound event:', error);
                        }
                      }
                    }
                  }

                  // hit detection: open hand hits fist
                  if (openIdx !== null && fistIdx !== null) {
                    const w2 = w;
                    const h2 = h;
                    const lmOpen = results.multiHandLandmarks[openIdx];
                    const lmFist = results.multiHandLandmarks[fistIdx];
                    const openTip = {
                      x: (1 - lmOpen[8].x) * w2,
                      y: lmOpen[8].y * h2,
                    };
                    const fistTip = {
                      x: (1 - lmFist[8].x) * w2,
                      y: lmFist[8].y * h2,
                    };
                    const dx = openTip.x - fistTip.x;
                    const dy = openTip.y - fistTip.y;
                    const dist = Math.hypot(dx, dy);
                    const prevOpen = previousPositionsRef.current.get(openIdx);
                    const prevFist = previousPositionsRef.current.get(fistIdx);
                    let approachSpeed = 0;
                    if (prevOpen && prevFist) {
                      const prevDist = Math.hypot(
                        prevOpen.x - prevFist.x,
                        prevOpen.y - prevFist.y
                      );
                      const dt = Math.max(
                        (now2 -
                          Math.max(prevOpen.timestamp, prevFist.timestamp)) /
                          1000,
                        1e-6
                      );
                      approachSpeed = (prevDist - dist) / dt; // positive when getting closer
                    }
                    const lastHit = lastHitRef.current || 0;
                    if (
                      dist < HIT_DISTANCE_PX &&
                      approachSpeed > HIT_SPEED_THRESHOLD &&
                      now2 - lastHit > HIT_COOLDOWN_MS
                    ) {
                      console.info("tambourine: hit detected", {
                        openIdx,
                        fistIdx,
                        dist,
                        approachSpeed,
                      });
                      playTambourineSlap(Math.min(1, approachSpeed / 2000));
                      lastHitRef.current = now2;
                      
                      // Send sound event to peers if peerManager is available
                      if (peerManager) {
                        try {
                          console.log('📤 Sending tambourine sound event to peers (slap):', { type: 'tambourine' });
                          peerManager.sendSoundEvent({
                            type: 'tambourine',
                          });
                          console.log('✅ Tambourine sound event sent successfully');
                        } catch (error) {
                          console.error('❌ Failed to send tambourine sound event:', error);
                        }
                      }
                    }
                  }
                }
              } catch (e) {
                // ignore gesture errors
              }
            } else {
              // no hands detected this frame: clear all shake intervals and
              // stop active audio sources immediately so sound stops.
              try {
                shakeIntervalRef.current.forEach((id) => clearInterval(id));
                shakeIntervalRef.current.clear();
              } catch (e) {
                // ignore
              }
              try {
                stopAllActiveSources();
              } catch (e) {
                // ignore
              }
            }

            // Extract wrist positions & handedness for calibration guidance
            const positions: {
              left?: { x: number; y: number };
              right?: { x: number; y: number };
            } = {};
            try {
              if (results.multiHandLandmarks && results.multiHandedness) {
                for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                  const landmarks = results.multiHandLandmarks[i];
                  const label = results.multiHandedness[i]?.label || "";
                  const wrist = landmarks[0];
                  const visualX = 1 - (wrist.x ?? 0);
                  if (label.toLowerCase().includes("left")) {
                    positions.right = { x: visualX, y: wrist.y };
                  } else if (label.toLowerCase().includes("right")) {
                    positions.left = { x: visualX, y: wrist.y };
                  }
                }
              }
            } catch (err) {
              console.warn(
                "Error parsing hand landmarks for calibration:",
                err
              );
            }
            setHandPositions(positions);
          });

          handsRef.current = hands;
        } catch (err) {
          console.error("Error initializing MediaPipe Hands:", err);
        }
      };

      checkAndInit();
    };

    initHands();

    return () => {
      // cleanup
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      // clear any shake intervals on unmount
      try {
        shakeIntervalRef.current.forEach((id) => clearInterval(id));
        shakeIntervalRef.current.clear();
      } catch (e) {
        // ignore
      }
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close();
        } catch (e) {
          // ignore
        }
        audioCtxRef.current = null;
      }
    };
  }, []);

  // ---- Local WebAudio helpers (tambourine synthesis, local to this component) ----
  const ensureAudio = async () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      // resume context on user gesture
      try {
        await audioCtxRef.current.resume();
      } catch (e) {
        // ignore
      }
    }
    return audioCtxRef.current;
  };

  const registerSource = (src: any, onEnd?: () => void) => {
    try {
      activeSourcesRef.current.add(src);
      const prev = (src as any).onended;
      (src as any).onended = () => {
        try {
          if (typeof onEnd === "function") {
            try {
              onEnd();
            } catch (e) {
              /* ignore */
            }
          }
          if (typeof prev === "function") {
            try {
              prev();
            } catch (e) {
              /* ignore */
            }
          }
        } finally {
          try {
            activeSourcesRef.current.delete(src);
          } catch (e) {
            /* ignore */
          }
        }
      };
    } catch (e) {
      // ignore
    }
  };

  const stopAllActiveSources = () => {
    try {
      activeSourcesRef.current.forEach((s) => {
        try {
          // some nodes expose stop, others may not
          if (typeof s.stop === "function") s.stop(0);
        } catch (e) {
          // ignore
        }
      });
      activeSourcesRef.current.clear();
      chingPlayingRef.current = false;
      oneshotPlayingRef.current = false;
    } catch (e) {
      // ignore
    }
  };

  const makeNoiseBuffer = (ctx: AudioContext, dur: number) => {
    const buf = ctx.createBuffer(
      1,
      Math.floor(ctx.sampleRate * dur),
      ctx.sampleRate
    );
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  };

  const playJingle = async (
    kind: "ting" | "ching" | "jing" | "slap" = "jing",
    intensity = 1
  ) => {
    const ctx = await ensureAudio();
    if (!ctx) return;
    // only allow one ching sound at a time
    // block ching if a oneshot (slap) is currently playing
    if (
      kind === "ching" &&
      (chingPlayingRef.current || oneshotPlayingRef.current)
    )
      return;
    // prefer samples if available
    if (samplesRef.current && samplesRef.current[kind]) {
      const srcS = ctx.createBufferSource();
      srcS.buffer = samplesRef.current[kind] as AudioBuffer;
      const g = ctx.createGain();
      g.gain.value = intensity;
      srcS.connect(g);
      g.connect(ctx.destination);
      if (kind === "ching") chingPlayingRef.current = true;
      srcS.start(ctx.currentTime + 0.001);
      registerSource(srcS, () => {
        if (kind === "ching") chingPlayingRef.current = false;
      });
      return;
    }
    const now = ctx.currentTime;
    const dur = 0.06 + Math.random() * 0.06;
    const buf = makeNoiseBuffer(ctx, dur);
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1500;

    const peaks: Record<string, number> = {
      ting: 9000,
      ching: 7000,
      jing: 5200,
      "ka-ching": 11000,
    };
    const peak = ctx.createBiquadFilter();
    peak.type = "peaking";
    peak.frequency.value = peaks[kind];
    peak.Q.value = 5 + Math.random() * 3;
    peak.gain.value = 6 + Math.random() * 6;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.9 * intensity, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.01);

    src.connect(hp);
    hp.connect(peak);
    peak.connect(gain);
    gain.connect(ctx.destination);

    src.start(now);
    if (kind === "ching") chingPlayingRef.current = true;
    src.start(now);
    src.stop(now + dur + 0.02);
    registerSource(src, () => {
      if (kind === "ching") chingPlayingRef.current = false;
    });
  };

  const playShakeBurst = async (intensity = 0.6) => {
    const ctx = await ensureAudio();
    if (!ctx) return;
    // prefer sample loop for shake
    if (samplesRef.current && samplesRef.current.shake) {
      const srcS = ctx.createBufferSource();
      srcS.buffer = samplesRef.current.shake as AudioBuffer;
      const g = ctx.createGain();
      g.gain.value = intensity;
      srcS.connect(g);
      g.connect(ctx.destination);
      srcS.start(ctx.currentTime + 0.001);
      // stop quickly to make it a burst
      srcS.stop(ctx.currentTime + 0.08 + Math.random() * 0.08);
      registerSource(srcS);
      return;
    }
    const now = ctx.currentTime;
    const dur = 0.03 + Math.random() * 0.06;
    const buf = makeNoiseBuffer(ctx, dur);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1600 + Math.random() * 1000;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 3200 + Math.random() * 3000;
    bp.Q.value = 1.8 + Math.random() * 2.5;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(intensity, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.01);
    src.connect(hp);
    hp.connect(bp);
    bp.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + dur + 0.01);
    registerSource(src);
  };

  const playTambourineSlap = async (intensity = 1) => {
    const ctx = await ensureAudio();
    if (!ctx) return;
    // prefer slap sample
    if (samplesRef.current && samplesRef.current.slap) {
      const srcS = ctx.createBufferSource();
      srcS.buffer = samplesRef.current.slap as AudioBuffer;
      const g = ctx.createGain();
      g.gain.value = intensity;
      srcS.connect(g);
      g.connect(ctx.destination);
      oneshotPlayingRef.current = true;
      srcS.start(ctx.currentTime + 0.001);
      registerSource(srcS, () => {
        oneshotPlayingRef.current = false;
      });
      return;
    }
    const now = ctx.currentTime;
    // body transient
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(120 + Math.random() * 120, now);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.0001, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.9 * intensity, now + 0.003);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 800;
    bp.Q.value = 0.9;
    osc.connect(bp);
    bp.connect(bodyGain);
    bodyGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
    oneshotPlayingRef.current = true;
    registerSource(osc, () => {
      oneshotPlayingRef.current = false;
    });

    // noise edge
    const dur = 0.06;
    const buffer = ctx.createBuffer(
      1,
      Math.floor(ctx.sampleRate * dur),
      ctx.sampleRate
    );
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const env = Math.exp(-i / (ctx.sampleRate * 0.012));
      data[i] = (Math.random() * 2 - 1) * env * 0.95 * intensity;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const hpf = ctx.createBiquadFilter();
    hpf.type = "highpass";
    hpf.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.exponentialRampToValueAtTime(1.0 * intensity, now + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    src.connect(hpf);
    hpf.connect(g);
    g.connect(ctx.destination);
    src.start(now);
    src.stop(now + dur + 0.01);
    registerSource(src);

    // small metallic cluster - reduce to a single oneshot to avoid rapid
    // repeated slap-like jingles when a user performs one hit.
    const jingles = 1;
    for (let i = 0; i < jingles; i++) {
      const startOffset = 0.002 + i * 0.006 + Math.random() * 0.006;
      const jDur = 0.04 + Math.random() * 0.03;
      const jBuf = makeNoiseBuffer(ctx, jDur);
      const jSrc = ctx.createBufferSource();
      jSrc.buffer = jBuf;
      const jHP = ctx.createBiquadFilter();
      jHP.type = "highpass";
      jHP.frequency.value = 2200 + Math.random() * 2000;
      const jGain = ctx.createGain();
      const jStart = now + startOffset;
      jGain.gain.setValueAtTime(0.0001, jStart);
      jGain.gain.exponentialRampToValueAtTime(0.8 * intensity, jStart + 0.002);
      jGain.gain.exponentialRampToValueAtTime(0.0001, jStart + jDur + 0.01);
      jSrc.connect(jHP);
      jHP.connect(jGain);
      jGain.connect(ctx.destination);
      jSrc.start(jStart);
      jSrc.stop(jStart + jDur + 0.02);
      registerSource(jSrc);
    }
  };

  // ---- Sample loader ----
  const samplesRef = useRef<Record<string, AudioBuffer | null> | null>(null);
  const samplesLoadedRef = useRef(false);

  const loadSamples = async () => {
    if (samplesLoadedRef.current) return;
    const ctx = await ensureAudio();
    if (!ctx) return;

    const base = "/public/sounds";
    const map: Record<
      string,
      {
        file: string;
        dur: number;
        gen: (t: number, i?: number, sr?: number) => number;
      }
    > = {
      ting: {
        file: `${base}/ching.mp3`,
        dur: 0.12,
        gen: (t: number) =>
          metallic(t, [7000, 8800], 0.018) +
          (Math.random() - 0.5) * Math.exp(-t / 0.01) * 0.12,
      },
      ching: {
        file: `${base}/ching.mp3`,
        dur: 0.14,
        gen: (t: number) =>
          metallic(t, [9000, 11000], 0.016) +
          (Math.random() - 0.5) * Math.exp(-t / 0.008) * 0.1,
      },
      jing: {
        file: `${base}/ching.mp3`,
        dur: 0.13,
        gen: (t: number) =>
          metallic(t, [4800, 6200, 7600], 0.02) +
          (Math.random() - 0.5) * Math.exp(-t / 0.012) * 0.1,
      },
      "ka-ching": {
        file: `${base}/ching.mp3`,
        dur: 0.1,
        gen: (t: number) =>
          metallic(t, [10000, 12500], 0.012) +
          (Math.random() - 0.5) * Math.exp(-t / 0.007) * 0.14,
      },
      shake: {
        file: `${base}/ching.mp3`,
        dur: 0.18,
        gen: (t: number, i?: number, sr?: number) => {
          const env = Math.exp(-t / 0.04);
          return (Math.random() * 2 - 1) * env * 0.45;
        },
      },
      slap: {
        file: `${base}/tambourine-hit.mp3`,
        dur: 0.18,
        gen: (t: number) => {
          const body =
            Math.sin(2 * Math.PI * 200 * t) * Math.exp(-t / 0.06) * 0.9;
          const edge = (Math.random() * 2 - 1) * Math.exp(-t / 0.01) * 0.7;
          return body + edge * 0.8;
        },
      },
      roll: {
        file: `${base}/ching.mp3`,
        dur: 0.45,
        gen: (t: number, i?: number, sr?: number) => {
          const idx = Math.floor(t / 0.06);
          const localT = t - idx * 0.06;
          const hit =
            Math.sin(2 * Math.PI * 220 * localT) *
            Math.exp(-localT / 0.04) *
            0.7;
          const j = (Math.random() * 2 - 1) * Math.exp(-localT / 0.02) * 0.25;
          return (hit + j) * Math.exp(-t / 0.15);
        },
      },
    };

    const makeBuffer = (
      dur: number,
      gen: (t: number, i: number, sr: number) => number
    ) => {
      const sr = ctx.sampleRate;
      const len = Math.max(1, Math.floor(sr * dur));
      const buf = ctx.createBuffer(1, len, sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        data[i] = gen(t, i, sr);
      }
      return buf;
    };

    const metallic = (t: number, freqs: number[], decay: number) => {
      let s = 0;
      for (let f of freqs)
        s += Math.sin(2 * Math.PI * f * t + Math.random() * 0.001);
      return s * Math.exp(-t / decay) * 0.6;
    };

    samplesRef.current = {};

    // try fetching real files first; if missing, fall back to generated buffers
    await Promise.all(
      Object.keys(map).map(async (k) => {
        const cfg = (map as any)[k];
        // Build a short list of candidate URLs to try (reduce 404 noise by
        // trying sensible locations / extensions). The server serves files
        // placed in `public/` at the site root, so try both `/sounds` and
        // `/sounds/tambourine` and allow .wav/.mp3/.mp4.
        const candidates: string[] = [];
        if (cfg.file) candidates.push(cfg.file);
        // if cfg.file used /public prefix, also try without it
        if (cfg.file && cfg.file.startsWith("/public")) {
          candidates.push(cfg.file.replace("/public", ""));
        }
        const baseNames = ["/sounds", "/sounds/tambourine", ""];
        const exts = [".wav", ".mp3", ".mp4"];
        for (const base of baseNames) {
          for (const ext of exts) {
            candidates.push(`${base}/${k}${ext}`);
          }
        }

        let loaded: AudioBuffer | null = null;
        for (const url of candidates) {
          try {
            const res = await fetch(url, { method: "GET" });
            if (!res.ok) continue;
            const ab = await res.arrayBuffer();
            // decodeAudioData rejects if format not supported
            loaded = await ctx.decodeAudioData(ab);
            (samplesRef.current as any)[k] = loaded;
            console.info("tambourine: loaded sample", k, "from", url);
            break;
          } catch (e) {
            // try next candidate
            continue;
          }
        }

        if (!loaded) {
          // fallback to generated buffer
          (samplesRef.current as any)[k] = makeBuffer(cfg.dur, cfg.gen);
          console.warn("tambourine: falling back to generated buffer for", k);
        }
      })
    );

    // attempt to load two user-preferred files if present in public/sounds
    try {
      const tryLoad = async (url: string) => {
        try {
          const r = await fetch(url);
          if (!r.ok) throw new Error("not found");
          const ab = await r.arrayBuffer();
          const buf = await ctx.decodeAudioData(ab);
          return buf;
        } catch (e) {
          return null;
        }
      };
      const ching = await tryLoad("/sounds/ching.mp3");
      if (ching) {
        (samplesRef.current as any)["ching"] = ching;
        console.info("tambourine: loaded /sounds/ching.mp3 as ching");
      }
      const oneshot = await tryLoad("/sounds/tambourine-one-shot-89171.mp3");
      if (oneshot) {
        (samplesRef.current as any)["slap"] = oneshot;
        console.info(
          "tambourine: loaded oneshot sample /sounds/tambourine-one-shot-89171.mp3"
        );
      }
    } catch (e) {
      // ignore
    }

    samplesLoadedRef.current = true;
  };

  const playShake = async (intensity = 0.6) => {
    // single call to playShakeBurst; repeated by intervals in the main loop
    await playShakeBurst(intensity);
  };

  const processFrame = async () => {
    if (!videoRef.current || !handsRef.current) return;
    try {
      if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        await handsRef.current.send({ image: videoRef.current });
      }
    } catch (err) {
      console.warn("MediaPipe send error (ignored):", err);
    }
    if (streamRef.current) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
    }
  };

  const startCamera = async () => {
    if (!videoRef.current || !handsRef.current) return;
    try {
      await ensureAudio();
      // attempt to load sample files (optional). Missing files will be ignored and synth will be used.
      loadSamples().catch(() => {});
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      videoRef.current.srcObject = stream;
      streamRef.current = stream;
      console.info("tambourine: startCamera() - stream acquired", stream);
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play();
        setIsActive(true);
        processFrame();
      };
    } catch (err) {
      console.error("Error starting camera:", err);
      alert(
        "Failed to access camera. Please ensure you have granted camera permissions."
      );
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
    previousPositionsRef.current.clear();
    lastTriggerRef.current.clear();
    // clear any running shake intervals so sound stops immediately
    shakeIntervalRef.current.forEach((id) => clearInterval(id));
    shakeIntervalRef.current.clear();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-8 py-16 px-8">
        <h1 className="text-4xl font-bold text-black dark:text-zinc-50">
          🪘 Air Tambourine
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Shake or flick your hands quickly near the camera to play tambourine
          jingles.
        </p>

        <div className="relative w-full max-w-2xl rounded-lg border-2 border-zinc-300 dark:border-zinc-700 overflow-hidden bg-black">
          <video
            ref={videoRef}
            className="w-full h-auto transform scale-x-[-1]"
            style={{ display: "none" }}
            playsInline
          />
          <canvas
            ref={canvasRef}
            className="w-full h-auto"
            width={640}
            height={480}
            style={{ background: "black" }}
          />
          <div className="absolute inset-0 pointer-events-none">
            <TambourineCalibration
              handPositions={handPositions}
              isCameraActive={isActive}
            />
          </div>
        </div>

        <div className="flex gap-4">
          {!isActive ? (
            <button
              onClick={startCamera}
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-8 text-secondary font-bold"
            >
              Start Camera
            </button>
          ) : (
            <button
              onClick={stopCamera}
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-red-600 px-8 text-white"
            >
              Stop Camera
            </button>
          )}

          <button
            onClick={async () => {
              await ensureAudio();
              await loadSamples();
              // prefer sample if available, otherwise synth
              playJingle("jing", 0.9);
              setTimeout(() => playShakeBurst(0.7), 60);
            }}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-blue-600 px-8 text-white"
          >
            Test Jingle
          </button>

          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-700 dark:text-gray-300">
              Velocity threshold: {Math.round(velocityThreshold)} px/s
            </label>
            <input
              type="range"
              min={300}
              max={5000}
              step={50}
              value={velocityThreshold}
              onChange={(e) => setVelocityThreshold(Number(e.target.value))}
              className="w-48"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
