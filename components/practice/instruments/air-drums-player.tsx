"use client";

import { useEffect, useRef, useState } from "react";
import { DrumKit } from "@/app/lib/sound/drum-kit";
import CalibrationWizard from "@/app/components/calibration/CalibrationWizard";
import { HandPositions } from "./instrument-types";

type HandsType = {
  setOptions: (options: any) => void;
  onResults: (callback: (results: any) => void) => void;
  send: (data: { image: HTMLVideoElement | HTMLCanvasElement }) => Promise<void>;
  close: () => Promise<void>;
};

export default function AirDrumsPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [handPositions, setHandPositions] = useState<HandPositions>({});
  const [isActive, setIsActive] = useState(false);
  const handsRef = useRef<HandsType | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const drumKitRef = useRef<DrumKit | null>(null);
  const [velocityThreshold, setVelocityThreshold] = useState<number>(1500);
  const [handSpeeds, setHandSpeeds] = useState<Record<number, number>>({});
  
  const previousPositionsRef = useRef<Map<number, { 
    indexX: number; 
    indexY: number; 
    thumbX: number; 
    thumbY: number; 
    timestamp: number 
  }>>(new Map());
  const lastTriggerRef = useRef<Map<number, number>>(new Map());
  const drumLastTriggerRef = useRef<Map<string, number>>(new Map());
  const hitFlashRef = useRef<Map<string, number>>(new Map());
  const prevVerticalSpeedRef = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    drumKitRef.current = new DrumKit();

    const initHands = () => {
      const checkAndInit = () => {
        const Hands = (window as any).Hands;

        if (!Hands) {
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

            const canvasWidth = canvasRef.current.width;
            const canvasHeight = canvasRef.current.height;

            const toPixelCoords = (normalizedX: number, normalizedY: number) => {
              return {
                x: Math.round(normalizedX * canvasWidth),
                y: Math.round(normalizedY * canvasHeight),
              };
            };

            const VELOCITY_THRESHOLD = velocityThreshold;
            const COOLDOWN_MS = 100;
            const DRUM_COOLDOWN_MS = 350;

            const drumRadius = Math.min(canvasWidth, canvasHeight) * 0.14;
            const drumY = canvasHeight * 0.74;
            const leftDrumX = canvasWidth * 0.2;
            const rightDrumX = canvasWidth * 0.8;

            const currentTime = performance.now();

            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
              results.multiHandLandmarks.forEach((landmarks: any[], handIndex: number) => {
                const indexTip = toPixelCoords(landmarks[8].x, landmarks[8].y);
                const previous = previousPositionsRef.current.get(handIndex);

                if (previous) {
                  const timeDelta = (currentTime - previous.timestamp) / 1000;
                  const indexVisualX = canvasWidth - indexTip.x;
                  const prevIndexVisualX = canvasWidth - previous.indexX;
                  const dy = indexTip.y - previous.indexY;
                  const dx = indexVisualX - prevIndexVisualX;
                  const verticalSpeed = timeDelta > 0 ? dy / timeDelta : 0;
                  const horizontalSpeed = timeDelta > 0 ? dx / timeDelta : 0;

                  const lastTrigger = lastTriggerRef.current.get(handIndex) || 0;
                  setHandSpeeds((prev) => ({ ...prev, [handIndex]: verticalSpeed }));

                  const MIN_DY_PIXELS = 6;
                  const HORIZ_SPEED_THRESHOLD = 350;

                  const bassX = canvasWidth * 0.5;
                  const bassY = canvasHeight * 0.88;
                  const bassRadius = Math.min(canvasWidth, canvasHeight) * 0.18;

                  const hiHatX = canvasWidth * 0.5;
                  const hiHatY = canvasHeight * 0.12;
                  const hiHatRadius = Math.min(canvasWidth, canvasHeight) * 0.12;

                  const distLeft = Math.hypot(indexVisualX - leftDrumX, indexTip.y - drumY);
                  const distRight = Math.hypot(indexVisualX - rightDrumX, indexTip.y - drumY);
                  const distBass = Math.hypot(indexVisualX - bassX, indexTip.y - bassY);
                  const distHiHat = Math.hypot(indexVisualX - hiHatX, indexTip.y - hiHatY);

                  const registerHit = (zoneId: string, play: () => void) => {
                    const lastDrumTrigger = drumLastTriggerRef.current.get(zoneId) || 0;
                    if ((currentTime - lastDrumTrigger) <= DRUM_COOLDOWN_MS) return false;
                    if ((currentTime - lastTrigger) <= COOLDOWN_MS) return false;
                    play();
                    lastTriggerRef.current.set(handIndex, currentTime);
                    drumLastTriggerRef.current.set(zoneId, currentTime);
                    hitFlashRef.current.set(zoneId, currentTime);
                    return true;
                  };

                  const prevSpeed = prevVerticalSpeedRef.current.get(handIndex) || 0;

                  if (
                    distLeft < drumRadius &&
                    dy > MIN_DY_PIXELS &&
                    verticalSpeed > VELOCITY_THRESHOLD &&
                    prevSpeed <= VELOCITY_THRESHOLD
                  ) {
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
                    if (horizontalSpeed > HORIZ_SPEED_THRESHOLD) {
                      if (drumKitRef.current) {
                        registerHit("right", () => drumKitRef.current!.playSnare());
                      }
                    }
                  }

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

                  prevVerticalSpeedRef.current.set(handIndex, verticalSpeed);
                }

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
            canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            canvasCtx.translate(canvasRef.current.width, 0);
            canvasCtx.scale(-1, 1);

            canvasCtx.drawImage(
              results.image,
              0,
              0,
              canvasRef.current.width,
              canvasRef.current.height
            );

            const drawDrum = (x: number, y: number, radius: number, label: string, fillColor: string) => {
              canvasCtx.beginPath();
              canvasCtx.arc(x, y, radius + 8, 0, Math.PI * 2);
              canvasCtx.fillStyle = "rgba(0,0,0,0.35)";
              canvasCtx.fill();

              const grad = canvasCtx.createRadialGradient(x - radius*0.3, y - radius*0.4, radius*0.1, x, y, radius);
              grad.addColorStop(0, fillColor);
              grad.addColorStop(1, "#222");
              canvasCtx.beginPath();
              canvasCtx.arc(x, y, radius, 0, Math.PI * 2);
              canvasCtx.fillStyle = grad;
              canvasCtx.fill();

              canvasCtx.beginPath();
              canvasCtx.arc(x, y - radius*0.15, radius*0.25, 0, Math.PI * 2);
              canvasCtx.fillStyle = "rgba(255,255,255,0.06)";
              canvasCtx.fill();

              canvasCtx.fillStyle = "#fff";
              canvasCtx.font = `${Math.max(12, Math.round(radius * 0.35))}px Arial`;
              canvasCtx.textAlign = "center";
              canvasCtx.fillText(label, x, y + radius + 18);
            };

            const FLASH_DURATION = 180;

            const drawDrumWithFlash = (id: string, x: number, y: number, radius: number, label: string, fillColor: string, emoji?: string) => {
              const flashAge = currentTime - (hitFlashRef.current.get(id) || 0);
              if (flashAge <= FLASH_DURATION) {
                const alpha = 1 - flashAge / FLASH_DURATION;
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

            drawDrumWithFlash("left", leftDrumX, drumY, drumRadius, "🥁 Snare (L)", "#4ECDC4", "🥁");
            drawDrumWithFlash("right", rightDrumX, drumY, drumRadius, "🥁 Snare (R)", "#FF6B6B", "🥁");

            const bassX = canvasWidth * 0.5;
            const bassY = canvasHeight * 0.88;
            const bassRadius = Math.min(canvasWidth, canvasHeight) * 0.18;
            drawDrumWithFlash("bass", bassX, bassY, bassRadius, "🔘 Bass", "#222222", "🔊");

            const hiHatX = canvasWidth * 0.5;
            const hiHatY = canvasHeight * 0.12;
            const hiHatRadius = Math.min(canvasWidth, canvasHeight) * 0.12;
            drawDrumWithFlash("hihat", hiHatX, hiHatY, hiHatRadius, "🎧 Hi-Hat", "#B4C6FF", "🎵");

            if (results.multiHandLandmarks) {
              for (const landmarks of results.multiHandLandmarks) {
                drawConnections(canvasCtx, landmarks, HAND_CONNECTIONS);
                drawLandmarks(canvasCtx, landmarks, {
                  color: "#00FF00",
                  lineWidth: 2,
                });
              }
            }

            const positions: HandPositions = {};
            try {
              if (results.multiHandLandmarks && results.multiHandedness) {
                for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                  const landmarks = results.multiHandLandmarks[i];
                  const handednessLabel = results.multiHandedness[i]?.label || "";
                  const wrist = landmarks[0];
                  const visualX = 1 - (wrist.x ?? 0);
                  if (handednessLabel.toLowerCase().includes("left")) {
                    positions.right = { x: visualX, y: wrist.y };
                  } else if (handednessLabel.toLowerCase().includes("right")) {
                    positions.left = { x: visualX, y: wrist.y };
                  }
                }
              }
            } catch (err) {
              console.warn("Error parsing hand landmarks for calibration:", err);
            }

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
  }, [velocityThreshold]);

  const processFrame = async () => {
    if (!videoRef.current || !handsRef.current) return;

    if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      await handsRef.current.send({ image: videoRef.current });
    }

    if (streamRef.current) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
    }
  };

  const startCamera = async () => {
    if (!videoRef.current || !handsRef.current) return;

    try {
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
    <div className="w-full flex flex-col items-center gap-6">
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
          <CalibrationWizard 
            handPositions={handPositions} 
            instrument="drums"
            isCameraActive={isActive}
          />
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

      <div className="w-full max-w-2xl flex flex-col gap-2">
        <label className="text-sm text-gray-600 dark:text-gray-300">
          Velocity threshold: {Math.round(velocityThreshold)} px/s
        </label>
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
    </div>
  );
}

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

function drawConnections(ctx: CanvasRenderingContext2D, landmarks: any[], connections: number[][]) {
  ctx.strokeStyle = "#00FF00";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const connection of connections) {
    const start = landmarks[connection[0]];
    const end = landmarks[connection[1]];
    ctx.moveTo(start.x * ctx.canvas.width, start.y * ctx.canvas.height);
    ctx.lineTo(end.x * ctx.canvas.width, end.y * ctx.canvas.height);
  }
  ctx.stroke();
}

function drawLandmarks(ctx: CanvasRenderingContext2D, landmarks: any[], style: { color: string; lineWidth: number }) {
  ctx.fillStyle = style.color;
  for (const landmark of landmarks) {
    ctx.beginPath();
    ctx.arc(landmark.x * ctx.canvas.width, landmark.y * ctx.canvas.height, 3, 0, 2 * Math.PI);
    ctx.fill();
  }
}

