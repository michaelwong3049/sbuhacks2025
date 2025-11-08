"use client";

import { useEffect, useRef, useState } from "react";
import { DrumKit } from "./lib/sound/drum-kit";
import CalibrationWizard from "./components/calibration/CalibrationWizard";

type HandsType = {
  setOptions: (options: any) => void;
  onResults: (callback: (results: any) => void) => void;
  send: (data: { image: HTMLVideoElement }) => Promise<void>;
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
  
  // Store previous hand positions for velocity calculation
  // Store both index finger and thumb positions (like holding a drumstick)
  const previousPositionsRef = useRef<Map<number, { 
    indexX: number; 
    indexY: number; 
    thumbX: number; 
    thumbY: number; 
    timestamp: number 
  }>>(new Map());

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
              return {
                x: Math.round((1 - normalizedX) * canvasWidth),
                y: Math.round((1 - normalizedY) * canvasHeight),
              };
            };

            // Define two snare zones (one for each hand) in the lower half of canvas
            // Made bigger and more rectangular
            const snareZoneWidth = 200;  // Increased width
            const snareZoneHeight = 150;   // Increased height
            const snareZoneY = canvasHeight * 0.55; // Position in lower half (55% down)
            
            // Left snare zone (for left hand or hand 0)
            const leftSnareZone = {
              x: canvasWidth * 0.15, // 15% from left
              y: snareZoneY,
              width: snareZoneWidth,
              height: snareZoneHeight,
            };
            
            // Right snare zone (for right hand or hand 1)
            const rightSnareZone = {
              x: canvasWidth * 0.55, // 55% from left
              y: snareZoneY,
              width: snareZoneWidth,
              height: snareZoneHeight,
            };

            // Velocity threshold for detecting a hit (pixels per second)
            // Lowered to be more lenient - easier to trigger hits
            const VELOCITY_THRESHOLD = 150; // Reduced from 300 to make it more sensitive

            // Check if point is in a snare zone
            const isInSnareZone = (x: number, y: number, zone: { x: number; y: number; width: number; height: number }) => {
              return (
                x >= zone.x &&
                x <= zone.x + zone.width &&
                y >= zone.y &&
                y <= zone.y + zone.height
              );
            };
            
            // Get the appropriate snare zone for a hand (left hand = left zone, right hand = right zone)
            const getSnareZoneForHand = (handIndex: number) => {
              return handIndex === 0 ? leftSnareZone : rightSnareZone;
            };

            // Calculate velocity (pixels per second)
            const calculateVelocity = (
              currentX: number,
              currentY: number,
              prevX: number,
              prevY: number,
              timeDelta: number
            ) => {
              const distance = Math.sqrt(
                Math.pow(currentX - prevX, 2) + Math.pow(currentY - prevY, 2)
              );
              return timeDelta > 0 ? distance / timeDelta : 0;
            };

            // Process hand detection and drum hits
            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
              const currentTime = Date.now();

              results.multiHandLandmarks.forEach((landmarks: any[], handIndex: number) => {
                // Use both index finger tip (landmark 8) and thumb tip (landmark 4) 
                // Like holding a drumstick between index and thumb
                const indexTip = toPixelCoords(landmarks[8].x, landmarks[8].y);
                const thumbTip = toPixelCoords(landmarks[4].x, landmarks[4].y);
                
                // Calculate midpoint between index and thumb (the "drumstick" position)
                const drumstickX = (indexTip.x + thumbTip.x) / 2;
                const drumstickY = (indexTip.y + thumbTip.y) / 2;

                // Get the snare zone for this hand
                const snareZone = getSnareZoneForHand(handIndex);

                // Get previous position for this hand
                const previous = previousPositionsRef.current.get(handIndex);

                if (previous) {
                  const timeDelta = (currentTime - previous.timestamp) / 1000; // Convert to seconds
                  
                  // Calculate previous drumstick position
                  const prevDrumstickX = (previous.indexX + previous.thumbX) / 2;
                  const prevDrumstickY = (previous.indexY + previous.thumbY) / 2;
                  
                  // Calculate ONLY downward (vertical) velocity
                  // In our coordinate system, y increases as you go down (0,0 is top-left)
                  // So downward movement means currentY > previousY
                  const yDelta = drumstickY - prevDrumstickY;
                  const downwardVelocity = timeDelta > 0 && yDelta > 0 ? yDelta / timeDelta : 0;
                  
                  // Only consider downward movement (positive yDelta means moving down)
                  const isMovingDownward = yDelta > 0;

                  // Check if either index finger OR thumb is in the snare zone
                  // (like the drumstick tip hitting the snare)
                  const indexInZone = isInSnareZone(indexTip.x, indexTip.y, snareZone);
                  const thumbInZone = isInSnareZone(thumbTip.x, thumbTip.y, snareZone);
                  const inZone = indexInZone || thumbInZone;
                  
                  // Check previous positions
                  const prevIndexInZone = isInSnareZone(previous.indexX, previous.indexY, snareZone);
                  const prevThumbInZone = isInSnareZone(previous.thumbX, previous.thumbY, snareZone);
                  const wasInZone = prevIndexInZone || prevThumbInZone;

                  // Detect hit: ONLY when:
                  // 1. Currently inside zone (index OR thumb)
                  // 2. Entering zone (not already inside)
                  // 3. Has sufficient DOWNWARD velocity (ignoring horizontal/upward movement)
                  // 4. Moving downward (toward snare, not away from it)
                  if (inZone && downwardVelocity > VELOCITY_THRESHOLD && !wasInZone && isMovingDownward) {
                    console.log(`🥁 SNARE HIT! Hand ${handIndex + 1} (${handIndex === 0 ? 'Left' : 'Right'} snare) - Downward Velocity: ${downwardVelocity.toFixed(2)} px/s, Index: (${indexTip.x}, ${indexTip.y}), Thumb: (${thumbTip.x}, ${thumbTip.y})`);
                    
                    // Play snare sound when hit is detected
                    if (drumKitRef.current) {
                      drumKitRef.current.playSnare().catch(console.error);
                    }
                  }
                }

                // Update previous position (both index and thumb)
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
            canvasCtx.drawImage(
              results.image,
              0,
              0,
              canvasRef.current.width,
              canvasRef.current.height
            );

            // Draw snare zones visualization
            const drawSnareZone = (zone: { x: number; y: number; width: number; height: number }, label: string, strokeColor: string, fillColor: string) => {
              canvasCtx.strokeStyle = strokeColor;
              canvasCtx.lineWidth = 3;
              canvasCtx.setLineDash([5, 5]);
              canvasCtx.strokeRect(zone.x, zone.y, zone.width, zone.height);
              canvasCtx.setLineDash([]);
              canvasCtx.fillStyle = fillColor;
              canvasCtx.fillRect(zone.x, zone.y, zone.width, zone.height);
              
              // Label the snare zone
              canvasCtx.fillStyle = strokeColor;
              canvasCtx.font = "14px Arial";
              canvasCtx.fillText(label, zone.x + 10, zone.y + 20);
            };
            
            drawSnareZone(leftSnareZone, "🥁 Left Snare", "#4ECDC4", "rgba(78, 205, 196, 0.1)");
            drawSnareZone(rightSnareZone, "🥁 Right Snare", "#FF6B6B", "rgba(255, 107, 107, 0.1)");

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
                  const handednessLabel =
                    results.multiHandedness[i]?.label || "";
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
              console.warn(
                "Error parsing hand landmarks for calibration:",
                err
              );
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
      // Initialize Tone.js audio context (requires user interaction)
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
      alert(
        "Failed to access camera. Please ensure you have granted camera permissions."
      );
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
        <h1 className="text-4xl font-bold text-black dark:text-zinc-50">
          🥁 Air Drums
        </h1>
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
            className="w-full h-auto transform scale-x-[-1]"
            width={640}
            height={480}
            style={{ background: "black" }}
          />
          {/* Drums-only calibration overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <CalibrationWizard handPositions={handPositions} />
          </div>
        </div>

        <div className="flex gap-4">
          {!isActive ? (
            <button
              onClick={startCamera}
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-foreground px-8 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium"
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

function drawConnections(
  ctx: CanvasRenderingContext2D,
  landmarks: any[],
  connections: number[][]
) {
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

function drawLandmarks(
  ctx: CanvasRenderingContext2D,
  landmarks: any[],
  style: { color: string; lineWidth: number }
) {
  ctx.fillStyle = style.color;
  for (const landmark of landmarks) {
    ctx.beginPath();
    ctx.arc(
      landmark.x * ctx.canvas.width,
      landmark.y * ctx.canvas.height,
      3,
      0,
      2 * Math.PI
    );
    ctx.fill();
  }
}

