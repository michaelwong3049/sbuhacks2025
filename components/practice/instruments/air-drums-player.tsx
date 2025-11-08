"use client";

import { useEffect, useRef, useState } from "react";
import { DrumKit } from "@/app/lib/sound/drum-kit";
import CalibrationWizard from "@/app/components/calibration/CalibrationWizard";
import { Hands } from "@mediapipe/hands";

type HandsType = {
  setOptions: (options: any) => void;
  onResults: (callback: (results: any) => void) => void;
  send: (data: { image: HTMLVideoElement | HTMLCanvasElement }) => Promise<void>;
  close: () => Promise<void>;
};

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [handPositions, setHandPositions] = useState<{
    left?: { x: number; y: number };
    right?: { x: number; y: number };
  }>({});
  const [isActive, setIsActive] = useState(false);
  const handsRef = useRef<HandsType | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const drumKitRef = useRef<DrumKit | null>(null);
  // Make default more forgiving so it's easier to trigger; user can lower further with slider.
  // Lower default a bit to make zones easier to hit.
  const [velocityThreshold, setVelocityThreshold] = useState<number>(1500);
  const [handSpeeds, setHandSpeeds] = useState<Record<number, number>>({});
  
  // Store previous hand positions for velocity calculation
  // Store both index finger and thumb positions (like holding a drumstick)
  const previousPositionsRef = useRef<Map<number, { 
    indexX: number; 
    indexY: number; 
    thumbX: number; 
    thumbY: number; 
    timestamp: number 
  }>>(new Map());
  const lastTriggerRef = useRef<Map<number, number>>(new Map());
  // Per-drum cooldowns keyed by 'left'|'right' to reduce double-triggering on the same visual drum
  const drumLastTriggerRef = useRef<Map<string, number>>(new Map());
  // Visual flash timestamps for zones when a hit is registered
  const hitFlashRef = useRef<Map<string, number>>(new Map());
  const prevVerticalSpeedRef = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

  // Initialize drum kit for sound playback
  drumKitRef.current = new DrumKit();

    // Load MediaPipe Hands from CDN
    const initHands = () => {
      // Check if Hands is already available (from script tag or previous load)
      const checkAndInit = () => {
        const Hands = (window as any).Hands;

        if (!Hands) {
          // If not available, load the script
          const script = document.createElement("script");
          script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";
          script.crossOrigin = "anonymous";
          script.onload = () => {
            const HandsClass = (window as any).Hands;
            if (HandsClass) {
              initializeHands(HandsClass);
            }
          };
          script.onerror = () => {
            console.error("Failed to load MediaPipe Hands script");
          };
          document.head.appendChild(script);
        } else {
          initializeHands(Hands);
        }
      };

      const initializeHands = (Hands: any) => {
        try {
          const hands = new Hands({
            locateFile: (file: string) => {
              return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            },
          });

          hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });

          hands.onResults((results: any) => {
            const canvasCtx = canvasRef.current?.getContext("2d");
            if (!canvasCtx || !canvasRef.current) return;

            // Get canvas dimensions for coordinate conversion
            const canvasWidth = canvasRef.current.width;
            const canvasHeight = canvasRef.current.height;

            // Helper function to convert normalized coordinates (0-1) to pixel coordinates
            const toPixelCoords = (normalizedX: number, normalizedY: number) => {
              // Keep X flipped for the mirrored video (visual left/right), but
              // do NOT flip Y — MediaPipe's normalized Y already increases downward
              // which matches canvas coordinates (0 at top). Flipping Y caused
              // upward gestures to appear as downward movement.
              // We will flip the canvas drawing context instead of flipping
              // the normalized X here. That keeps logical coordinates in a
              // standard left-to-right space (normalizedX * width) while
              // allowing us to mirror the visual output with `ctx.scale(-1,1)`
              // so drawn text remains readable.
              return {
                x: Math.round(normalizedX * canvasWidth),
                y: Math.round(normalizedY * canvasHeight),
              };
            };

            // Trigger on high finger/hand velocity (any direction) instead of entering a snare zone.
            // This detects quick motions of the index finger tip and plays a sound when speed exceeds a threshold.
            // Require much stronger/faster motion to trigger a hit. Increase this if light motions still trigger.
            // Typical tuning notes:
            // - 1600: medium fast gestures
            // - 3000-5000: fast, deliberate strikes
            // - >5000: very aggressive gestures only
              // Trigger on high downward finger velocity. The threshold is adjustable at runtime.
              const VELOCITY_THRESHOLD = velocityThreshold; // px/s (adjustable via UI)
            const COOLDOWN_MS = 100; // per-hand cooldown (ms)
            const DRUM_COOLDOWN_MS = 350; // per-drum cooldown to reduce double hits on same visual drum (tuned up)

            // Precompute drum positions for per-drum cooldown checks (mirror-consistent with drawing below)
            // Slightly larger drums to make zones more forgiving
            const drumRadius = Math.min(canvasWidth, canvasHeight) * 0.14;
            const drumY = canvasHeight * 0.74; // place drums toward the bottom
            const leftDrumX = canvasWidth * 0.2;
            const rightDrumX = canvasWidth * 0.8;

            // A single timestamp used for cooldowns and hit flashes
            const currentTime = performance.now();

            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {

              results.multiHandLandmarks.forEach((landmarks: any[], handIndex: number) => {
                // Use index finger tip (landmark 8) for velocity tracking
                const indexTip = toPixelCoords(landmarks[8].x, landmarks[8].y);

                const previous = previousPositionsRef.current.get(handIndex);

                if (previous) {
                  const timeDelta = (currentTime - previous.timestamp) / 1000; // seconds
                  // Convert to visual X coordinates because the canvas drawing
                  // context is flipped horizontally (we mirrored the canvas
                  // for a user-friendly view). The indexTip.x returned by
                  // toPixelCoords is in logical (sensor) coords; convert to
                  // visual coords by mirroring across the canvas width.
                  const indexVisualX = canvasWidth - indexTip.x;
                  const prevIndexVisualX = canvasWidth - previous.indexX;
                  const dy = indexTip.y - previous.indexY;
                  const dx = indexVisualX - prevIndexVisualX;
                  // Speeds in px/s
                  const verticalSpeed = timeDelta > 0 ? dy / timeDelta : 0; // px/s downward
                  const horizontalSpeed = timeDelta > 0 ? dx / timeDelta : 0; // px/s rightward

                  const lastTrigger = lastTriggerRef.current.get(handIndex) || 0;
                  // Update debug UI with current vertical speed for this hand
                  setHandSpeeds((prev) => ({ ...prev, [handIndex]: verticalSpeed }));

                  // Zone detection thresholds
                  const MIN_DY_PIXELS = 6; // displacement guard
                  // Reduce horizontal requirement so side snares are easier to hit
                  const HORIZ_SPEED_THRESHOLD = 350; // px/s horizontal requirement for side snares

                  // Define zones (match drawing positions)
                  const bassX = canvasWidth * 0.5;
                  const bassY = canvasHeight * 0.88;
                  const bassRadius = Math.min(canvasWidth, canvasHeight) * 0.18;

                  const hiHatX = canvasWidth * 0.5;
                  const hiHatY = canvasHeight * 0.12; // move hi-hat to top
                  const hiHatRadius = Math.min(canvasWidth, canvasHeight) * 0.12; // make hi-hat easier to hit

                  // distance to each zone center
                  const distLeft = Math.hypot(indexVisualX - leftDrumX, indexTip.y - drumY);
                  const distRight = Math.hypot(indexVisualX - rightDrumX, indexTip.y - drumY);
                  const distBass = Math.hypot(indexVisualX - bassX, indexTip.y - bassY);
                  const distHiHat = Math.hypot(indexVisualX - hiHatX, indexTip.y - hiHatY);

                  // Helper to register hit (set per-hand and per-zone cooldowns and visual flash)
                  const registerHit = (zoneId: string, play: () => void) => {
                    const lastDrumTrigger = drumLastTriggerRef.current.get(zoneId) || 0;
                    if ((currentTime - lastDrumTrigger) <= DRUM_COOLDOWN_MS) return false;
                    // pass per-hand cooldown too
                    if ((currentTime - lastTrigger) <= COOLDOWN_MS) return false;
                    // trigger
                    play();
                    lastTriggerRef.current.set(handIndex, currentTime);
                    drumLastTriggerRef.current.set(zoneId, currentTime);
                    // record flash
                    (hitFlashRef.current as Map<string, number>).set(zoneId, currentTime);
                    return true;
                  };

                  // Read previous vertical speed once (default 0)
                  const prevSpeed = prevVerticalSpeedRef.current.get(handIndex) || 0;

                  // Side snares require downward + horizontal motion towards the drum
                  if (
                    distLeft < drumRadius &&
                    dy > MIN_DY_PIXELS &&
                    verticalSpeed > VELOCITY_THRESHOLD &&
                    prevSpeed <= VELOCITY_THRESHOLD
                  ) {
                    // moving towards left drum means horizontalSpeed is negative (leftward) if approaching
                    if (horizontalSpeed < -HORIZ_SPEED_THRESHOLD) {
                      if (drumKitRef.current) {
                        registerHit("left", () => drumKitRef.current!.playSnare());
                      }
                    }
                  }

                  if (
                    distRight < drumRadius &&
                    dy > MIN_DY_PIXELS &&
                    verticalSpeed > VELOCITY_THRESHOLD &&
                    prevSpeed <= VELOCITY_THRESHOLD
                  ) {
                    // moving towards right drum means horizontalSpeed is positive (rightward)
                    if (horizontalSpeed > HORIZ_SPEED_THRESHOLD) {
                      if (drumKitRef.current) {
                        registerHit("right", () => drumKitRef.current!.playSnare());
                      }
                    }
                  }

                  // Bass (kick) at bottom: only downward movement needed
                  if (
                    distBass < bassRadius &&
                    dy > MIN_DY_PIXELS &&
                    verticalSpeed > VELOCITY_THRESHOLD &&
                    prevSpeed <= VELOCITY_THRESHOLD
                  ) {
                    if (drumKitRef.current) {
                      registerHit("bass", () => drumKitRef.current!.playKick());
                    }
                  }

                  // Hi-hat: top zone, triggered by upward motion (user flicks up into the hi-hat)
                  // Upward motion produces negative verticalSpeed (dy < 0)
                  if (
                    distHiHat < hiHatRadius &&
                    dy < -MIN_DY_PIXELS &&
                    verticalSpeed < -VELOCITY_THRESHOLD &&
                    prevSpeed >= -VELOCITY_THRESHOLD
                  ) {
                    if (drumKitRef.current) {
                      registerHit("hihat", () => drumKitRef.current!.playHiHat());
                    }
                  }

                  // store current vertical speed for next-frame edge detection
                  prevVerticalSpeedRef.current.set(handIndex, verticalSpeed);
                }

                // Update previous position (store index & thumb to preserve existing data shape)
                const thumbTip = toPixelCoords(landmarks[4].x, landmarks[4].y);
                previousPositionsRef.current.set(handIndex, {
                  indexX: indexTip.x,
                  indexY: indexTip.y,
                  thumbX: thumbTip.x,
                  thumbY: thumbTip.y,
                  timestamp: currentTime,
                });
              });
            }

            canvasCtx.save();
            canvasCtx.clearRect(
              0,
              0,
              canvasRef.current.width,
              canvasRef.current.height
            );

            // Draw the camera image mirrored so the view feels natural to the user.
            // We only mirror the image drawing; overlays (text/labels/landmarks)
            // are drawn afterwards in the normal transform so they remain readable.
            canvasCtx.save();
            canvasCtx.translate(canvasRef.current.width, 0);
            canvasCtx.scale(-1, 1);
            canvasCtx.drawImage(
              results.image,
              0,
              0,
              canvasRef.current.width,
              canvasRef.current.height
            );
            canvasCtx.restore();

            // Draw drum visuals near the bottom of the camera view so the
            // user has a visual target. These are stylized drawn drums (no
            // external image assets required).
            const drawDrum = (x: number, y: number, radius: number, label: string, fillColor: string) => {
              // rim
              canvasCtx.beginPath();
              canvasCtx.arc(x, y, radius + 8, 0, Math.PI * 2);
              canvasCtx.fillStyle = "rgba(0,0,0,0.35)";
              canvasCtx.fill();

              // drum body (radial gradient)
              const grad = canvasCtx.createRadialGradient(x - radius*0.3, y - radius*0.4, radius*0.1, x, y, radius);
              grad.addColorStop(0, fillColor);
              grad.addColorStop(1, "#222");
              canvasCtx.beginPath();
              canvasCtx.arc(x, y, radius, 0, Math.PI * 2);
              canvasCtx.fillStyle = grad;
              canvasCtx.fill();

              // center highlight
              canvasCtx.beginPath();
              canvasCtx.arc(x, y - radius*0.15, radius*0.25, 0, Math.PI * 2);
              canvasCtx.fillStyle = "rgba(255,255,255,0.06)";
              canvasCtx.fill();

              // label
              canvasCtx.fillStyle = "#fff";
              canvasCtx.font = `${Math.max(12, Math.round(radius * 0.35))}px Arial`;
              canvasCtx.textAlign = "center";
              canvasCtx.fillText(label, x, y + radius + 18);
            };

            // Provide visual flash when a drum was recently hit
            const flashLeft = (hitFlashRef.current.get("left") || 0);
            const flashRight = (hitFlashRef.current.get("right") || 0);
            const flashBass = (hitFlashRef.current.get("bass") || 0);
            const flashHiHat = (hitFlashRef.current.get("hihat") || 0);
            const FLASH_DURATION = 180; // ms

            const drawDrumWithFlash = (id: string, x: number, y: number, radius: number, label: string, fillColor: string, emoji?: string) => {
              const flashAge = currentTime - (hitFlashRef.current.get(id) || 0);
              if (flashAge <= FLASH_DURATION) {
                const alpha = 1 - flashAge / FLASH_DURATION;
                // bright rim
                canvasCtx.beginPath();
                canvasCtx.arc(x, y, radius + 12, 0, Math.PI * 2);
                canvasCtx.fillStyle = `rgba(255,255,200,${0.5 * alpha})`;
                canvasCtx.fill();
              }
              drawDrum(x, y, radius, label, fillColor);
              if (emoji) {
                canvasCtx.font = `${Math.max(16, Math.round(radius * 0.9))}px Arial`;
                canvasCtx.fillText(emoji, x, y + Math.round(radius * 0.05));
              }
            };

            // Draw left/right snares
            drawDrumWithFlash("left", leftDrumX, drumY, drumRadius, "🥁 Snare (L)", "#4ECDC4", "🥁");
            drawDrumWithFlash("right", rightDrumX, drumY, drumRadius, "🥁 Snare (R)", "#FF6B6B", "🥁");

            // Draw bass (kick) at bottom center
            const bassX = canvasWidth * 0.5;
            const bassY = canvasHeight * 0.88;
            const bassRadius = Math.min(canvasWidth, canvasHeight) * 0.18;
            drawDrumWithFlash("bass", bassX, bassY, bassRadius, "🔘 Bass", "#222222", "🔊");

            // Draw hi-hat at top center (match detection zone)
            const hiHatX = canvasWidth * 0.5;
            const hiHatY = canvasHeight * 0.12;
            const hiHatRadius = Math.min(canvasWidth, canvasHeight) * 0.12;
            drawDrumWithFlash("hihat", hiHatX, hiHatY, hiHatRadius, "🎧 Hi-Hat", "#B4C6FF", "🎵");

            // Draw hand landmarks
            if (results.multiHandLandmarks) {
              for (const landmarks of results.multiHandLandmarks) {
                // Draw connections
                drawConnections(canvasCtx, landmarks, HAND_CONNECTIONS);
                // Draw landmarks
                drawLandmarks(canvasCtx, landmarks, {
                  color: "#00FF00",
                  lineWidth: 2,
                });
              }
            }

            // Extract wrist positions and handedness for calibration guidance
            const positions: {
              left?: { x: number; y: number };
              right?: { x: number; y: number };
            } = {};
            try {
              if (results.multiHandLandmarks && results.multiHandedness) {
                for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                  const landmarks = results.multiHandLandmarks[i];
                  const handednessLabel = results.multiHandedness[i]?.label || "";
                  // MediaPipe: landmark 0 is wrist; x,y are normalized [0..1]
                  const wrist = landmarks[0];
                  // The canvas/video element is mirrored via CSS (scale-x-[-1]) so
                  // the visual left/right the user sees is flipped. To keep the
                  // overlay guidance intuitive, compute the visual X by flipping
                  // the normalized landmark X and assign handedness accordingly
                  // (MediaPipe's "Left" refers to the subject's left).
                  const visualX = 1 - (wrist.x ?? 0);
                  if (handednessLabel.toLowerCase().includes("left")) {
                    // subject's left appears on the right side of the mirrored view
                    positions.right = { x: visualX, y: wrist.y };
                  } else if (handednessLabel.toLowerCase().includes("right")) {
                    // subject's right appears on the left side of the mirrored view
                    positions.left = { x: visualX, y: wrist.y };
                  }
                }
              }
            } catch (err) {
              // swallow any parsing errors
              console.warn("Error parsing hand landmarks for calibration:", err);
            }

            // Update React state used by calibration UI
            setHandPositions(positions);

            canvasCtx.restore();
          });

          handsRef.current = hands;
        } catch (error) {
          console.error("Error initializing MediaPipe Hands:", error);
        }
      };

      checkAndInit();
    };

    initHands();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (drumKitRef.current) {
        drumKitRef.current.dispose();
      }
    };
  }, []);

  const processFrame = async () => {
    // Keep the RAF loop running as long as the camera stream is active.
    if (!videoRef.current) return;

    try {
      if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        // Only call MediaPipe when it's available. If it's not yet loaded,
        // skip sending for this frame but continue the loop so the camera
        // appears active immediately.
        if (handsRef.current) {
          try {
            await handsRef.current.send({ image: videoRef.current });
          } catch (err) {
            // Don't let a transient error stop the loop.
            console.warn("MediaPipe send error (ignored):", err);
          }
        }
      }
    } catch (err) {
      console.warn("processFrame error:", err);
    }

    if (streamRef.current) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
    }
  };

  const startCamera = async () => {
    if (!videoRef.current) return;

    try {
      // Initialize audio context for the drum kit (requires user interaction)
      if (drumKitRef.current) {
        await drumKitRef.current.initialize();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;

        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            // Start playing video and the RAF loop regardless of whether
            // MediaPipe Hands has finished loading. processFrame will only
            // call into MediaPipe when it's available.
            videoRef.current.play();
            setIsActive(true);
            processFrame();
          }
        };
      }
    } catch (error) {
      console.error("Error starting camera:", error);
      alert("Failed to access camera. Please ensure you have granted camera permissions.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
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
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-8 py-16 px-8">
        <h1 className="text-4xl font-bold text-black dark:text-zinc-50">🥁 Air Drums</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Move your hands quickly downward into the snare zones to play sounds
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
          {/* Drums-only calibration overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <CalibrationWizard handPositions={handPositions} isCameraActive={isActive} />
          </div>
        </div>

        <div className="flex gap-4">
          {!isActive ? (
            <button
              onClick={startCamera}
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-8 text-secondary transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] font-bold"
            >
              Start Camera
            </button>
          ) : (
            <button
              onClick={stopCamera}
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-red-600 px-8 text-white transition-colors hover:bg-red-700 font-medium"
            >
              Stop Camera
            </button>
          )}
        </div>

        {/* Runtime tuning UI: threshold slider and per-hand speed readout */}
        <div className="w-full max-w-2xl flex flex-col gap-2 mt-4">
          <label className="text-sm text-gray-600 dark:text-gray-300">Velocity threshold: {Math.round(velocityThreshold)} px/s</label>
          <input
            type="range"
            min={500}
            max={8000}
            step={100}
            value={velocityThreshold}
            onChange={(e) => setVelocityThreshold(Number(e.target.value))}
            className="w-full"
          />

          <div className="flex gap-4 mt-2 text-sm text-gray-700 dark:text-gray-300">
            {Object.keys(handSpeeds).length === 0 ? (
              <div className="text-xs">Hand speeds will appear here while the camera is active.</div>
            ) : (
              Object.entries(handSpeeds).map(([hand, speed]) => (
                <div key={hand} className="p-2 rounded bg-zinc-100 dark:bg-zinc-800">
                  <div className="font-medium">Hand {Number(hand) + 1}</div>
                  <div>{Math.round(speed)} px/s (vertical)</div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// Helper functions for drawing
const HAND_CONNECTIONS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];

function drawConnections(ctx: CanvasRenderingContext2D, landmarks: any[], connections: number[][]) {
  ctx.strokeStyle = "#00FF00";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const connection of connections) {
    const start = landmarks[connection[0]];
    const end = landmarks[connection[1]];
    // Mirror X when drawing so overlays align with the mirrored camera image
    const startX = ctx.canvas.width - (start.x * ctx.canvas.width);
    const startY = start.y * ctx.canvas.height;
    const endX = ctx.canvas.width - (end.x * ctx.canvas.width);
    const endY = end.y * ctx.canvas.height;
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
  }
  ctx.stroke();
}

function drawLandmarks(ctx: CanvasRenderingContext2D, landmarks: any[], style: { color: string; lineWidth: number }) {
  ctx.fillStyle = style.color;
  for (const landmark of landmarks) {
    // Mirror X so landmarks align with mirrored camera image
    const x = ctx.canvas.width - (landmark.x * ctx.canvas.width);
    const y = landmark.y * ctx.canvas.height;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, 2 * Math.PI);
    ctx.fill();
  }
}