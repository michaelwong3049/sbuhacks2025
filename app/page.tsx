"use client";

import { useEffect, useRef, useState } from "react";
import { DrumKit } from "./lib/sound/drum-kit";
import { HitboxDetector, Hitbox } from "./lib/motion/hitbox-detector";

type HandsType = {
  setOptions: (options: any) => void;
  onResults: (callback: (results: any) => void) => void;
  send: (data: { image: HTMLVideoElement }) => Promise<void>;
  close: () => Promise<void>;
};

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isActive, setIsActive] = useState(false);
  const handsRef = useRef<HandsType | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const drumKitRef = useRef<DrumKit | null>(null);
  const hitboxDetectorRef = useRef<HitboxDetector | null>(null);
  const lastFrameTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    // Initialize drum kit
    drumKitRef.current = new DrumKit();

    // Initialize hitbox detector
    hitboxDetectorRef.current = new HitboxDetector();

    // Add a hitbox in the center of the screen
    // Hitbox is defined in normalized coordinates (0-1)
    // Making it bigger and more centered for easier testing
    const hitbox: Hitbox = {
      x: 0.3, // left edge (30% from left)
      y: 0.3, // top edge (30% from top)
      width: 0.4, // width (40% of screen)
      height: 0.4, // height (40% of screen)
    };
    hitboxDetectorRef.current.addHitbox(hitbox);
    console.log("Hitbox added:", hitbox, "Canvas size:", canvasRef.current?.width, canvasRef.current?.height);
    
    // Draw hitbox immediately as a test (before MediaPipe starts)
    const drawInitialHitbox = () => {
      const canvasCtx = canvasRef.current?.getContext("2d");
      if (canvasCtx && canvasRef.current && hitboxDetectorRef.current) {
        const hitboxes = hitboxDetectorRef.current.getHitboxes();
        if (hitboxes.length > 0) {
          canvasCtx.fillStyle = "#000000";
          canvasCtx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          hitboxes.forEach((hb) => {
            drawHitbox(canvasCtx, hb, canvasRef.current!.width, canvasRef.current!.height);
          });
          console.log("Initial hitbox drawn!");
        }
      }
    };
    
    // Try to draw immediately, and also after a short delay
    setTimeout(drawInitialHitbox, 100);

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

            const now = Date.now();
            const deltaTime = lastFrameTimeRef.current > 0 
              ? (now - lastFrameTimeRef.current) / 1000 
              : 0.016; // Assume 60fps for first frame
            lastFrameTimeRef.current = now;

            canvasCtx.save();
            canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            
            // Draw video frame if available
            if (results.image) {
              canvasCtx.drawImage(
                results.image,
                0,
                0,
                canvasRef.current.width,
                canvasRef.current.height
              );
            } else {
              // Draw black background if no image
              canvasCtx.fillStyle = "#000000";
              canvasCtx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }

            // Process hand landmarks and detect hits
            if (results.multiHandLandmarks && hitboxDetectorRef.current) {
              results.multiHandLandmarks.forEach((landmarks: any[], handIndex: number) => {
                // Use index finger tip (landmark 8) for hit detection
                const indexFingerTip = landmarks[8];
                if (indexFingerTip) {
                  const handPosition = {
                    x: indexFingerTip.x,
                    y: indexFingerTip.y,
                    z: indexFingerTip.z,
                  };

                  // Detect hits
                  const hitHitboxes = hitboxDetectorRef.current!.detectHits(
                    handIndex,
                    handPosition,
                    deltaTime
                  );

                  // Play sound for each hit
                  if (hitHitboxes.length > 0 && drumKitRef.current) {
                    // Play snare for each hit (no need to await, sounds play independently)
                    drumKitRef.current.playSnare().catch(console.error);
                  }
                }

                // Draw connections
                drawConnections(canvasCtx, landmarks, HAND_CONNECTIONS);
                // Draw landmarks
                drawLandmarks(canvasCtx, landmarks, { color: "#00FF00", lineWidth: 2 });
              });
            }

            // Draw hitbox AFTER drawing hands (so it's always on top and visible)
            if (hitboxDetectorRef.current) {
              const hitboxes = hitboxDetectorRef.current.getHitboxes();
              if (hitboxes.length > 0) {
                hitboxes.forEach((hb, index) => {
                  drawHitbox(canvasCtx, hb, canvasRef.current!.width, canvasRef.current!.height);
                });
              } else {
                console.log("No hitboxes found!");
              }
            } else {
              console.log("Hitbox detector not initialized!");
            }

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
        <h1 className="text-4xl font-bold text-black dark:text-zinc-50">
          🥁 Air Drums - Hit the Pink Zone!
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Move your hand quickly into the pink hit zone to play a snare sound
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
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17]
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

function drawHitbox(
  ctx: CanvasRenderingContext2D,
  hitbox: Hitbox,
  canvasWidth: number,
  canvasHeight: number
) {
  const x = hitbox.x * canvasWidth;
  const y = hitbox.y * canvasHeight;
  const width = hitbox.width * canvasWidth;
  const height = hitbox.height * canvasHeight;

  // Draw hitbox fill (semi-transparent pink) - more opaque
  ctx.fillStyle = "rgba(255, 0, 255, 0.4)";
  ctx.fillRect(x, y, width, height);

  // Draw hitbox border (bright pink, thicker)
  ctx.strokeStyle = "#FF00FF";
  ctx.lineWidth = 5;
  ctx.setLineDash([15, 5]);
  ctx.strokeRect(x, y, width, height);
  ctx.setLineDash([]);

  // Draw additional outer glow
  ctx.strokeStyle = "rgba(255, 0, 255, 0.6)";
  ctx.lineWidth = 8;
  ctx.strokeRect(x - 2, y - 2, width + 4, height + 4);

  // Draw hitbox label with background
  ctx.save();
  ctx.fillStyle = "#FF00FF";
  ctx.font = "bold 24px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const text = "HIT ZONE";
  const textX = x + width / 2;
  const textY = y + height / 2;
  
  // Draw text background (larger)
  const textMetrics = ctx.measureText(text);
  ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
  ctx.fillRect(
    textX - textMetrics.width / 2 - 10, 
    textY - 18, 
    textMetrics.width + 20, 
    36
  );
  
  // Draw text
  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = "#FF00FF";
  ctx.lineWidth = 2;
  ctx.strokeText(text, textX, textY);
  ctx.fillText(text, textX, textY);
  ctx.restore();
}
