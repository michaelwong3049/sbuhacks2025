"use client";

import { useEffect, useRef, useState } from "react";
import { Piano } from "./lib/sound/piano";
import { AutoPaperDetector } from "./lib/vision/auto-paper-detector";

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
  const [paperDetected, setPaperDetected] = useState(false);
  const handsRef = useRef<HandsType | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const pianoRef = useRef<Piano | null>(null);
  const paperDetectorRef = useRef<AutoPaperDetector | null>(null);
  
  // Track which keys are currently being pressed (to avoid retriggering)
  const activeKeysRef = useRef<Map<number, number>>(new Map()); // handIndex -> keyIndex
  const keyCooldownRef = useRef<Map<string, number>>(new Map()); // "handIndex-keyIndex" -> timestamp
  const handCooldownRef = useRef<Map<number, number>>(new Map()); // handIndex -> last press timestamp (global cooldown)
  const keyReleaseTimeRef = useRef<Map<number, number>>(new Map()); // handIndex -> timestamp when key was released
  const detectionFrameCountRef = useRef<number>(0); // Count frames for periodic detection

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    // Initialize piano for sound playback
    pianoRef.current = new Piano();
    
    // Initialize automatic paper detector
    if (!paperDetectorRef.current) {
      paperDetectorRef.current = new AutoPaperDetector();
      console.log("📄 Auto paper detector initialized");
    }

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
            // Coordinate system:
            // - MediaPipe: processes raw video, gives coordinates where x=0 is left side of raw video
            // - Canvas buffer: raw (non-mirrored), getImageData() returns raw buffer
            // - Canvas display: CSS-mirrored (scale-x-[-1]) - visually flipped
            // - Paper detection: works on raw buffer, coordinates in raw space
            //
            // Key insight: CSS mirroring flips the VISUAL display, not the canvas buffer
            // - If we draw at x=100, CSS displays it at (width-100) visually
            // - MediaPipe says finger at x=0.2*width (left in raw video)
            // - User sees finger on left (because video is mirrored)
            // - To draw circle on left: draw at flipped position x=0.8*width, CSS mirrors it back to 0.2*width
            const toPixelCoords = (normalizedX: number, normalizedY: number) => {
              // Flip X so that after CSS mirroring, it appears in the correct position
              // MediaPipe raw x=0.2 (left) → draw at x=0.8 (right) → CSS mirrors to 0.2 (left) ✓
              return {
                x: Math.round((1 - normalizedX) * canvasWidth), // Flip X for CSS mirroring
                y: Math.round(normalizedY * canvasHeight),
              };
            };
            
            // Helper to flip X coordinate (convert between raw and display coordinates)
            const flipX = (x: number) => canvasWidth - x;

            // Paper piano configuration
            const KEY_COOLDOWN_MS = 300; // Increased cooldown to prevent double triggers (was 150ms)
            const GLOBAL_COOLDOWN_MS = 200; // Minimum time between any key presses from same hand
            // Z-depth threshold: MediaPipe Z is negative when closer to camera
            // When finger touches paper, Z should be close to paper plane
            const Z_TOUCH_THRESHOLD = -0.015; // Finger touching paper

            // Draw paper and key regions if detected
            const drawPaperPiano = () => {
              if (!paperDetectorRef.current) {
                return;
              }

              if (!paperDetectorRef.current.isDetected()) {
                // Show detection status
                canvasCtx.fillStyle = "rgba(255, 255, 255, 0.9)";
                canvasCtx.font = "bold 20px Arial";
                canvasCtx.textAlign = "center";
                canvasCtx.fillText(
                  "📄 Detecting paper...",
                  canvasWidth / 2,
                  canvasHeight / 2 - 20
                );
                canvasCtx.font = "16px Arial";
                canvasCtx.fillText(
                  "Place a white paper on your table",
                  canvasWidth / 2,
                  canvasHeight / 2 + 10
                );
                return;
              }

              const paperCorners = paperDetectorRef.current.getPaperCorners();
              const keyRegions = paperDetectorRef.current.getKeyRegions();
              
              if (!paperCorners || keyRegions.length === 0) {
                console.error("Paper corners or key regions are empty!");
                return;
              }

              // Draw paper outline
              // DON'T flip paper coordinates - CSS mirroring will handle it automatically
              // This way paper and finger coordinates stay in sync (both in raw space)
              canvasCtx.strokeStyle = "#00FF00";
              canvasCtx.lineWidth = 3;
              canvasCtx.beginPath();
              canvasCtx.moveTo(paperCorners.topLeft.x, paperCorners.topLeft.y);
              canvasCtx.lineTo(paperCorners.topRight.x, paperCorners.topRight.y);
              canvasCtx.lineTo(paperCorners.bottomRight.x, paperCorners.bottomRight.y);
              canvasCtx.lineTo(paperCorners.bottomLeft.x, paperCorners.bottomLeft.y);
              canvasCtx.closePath();
              canvasCtx.stroke();

              // Draw corner markers
              const corners = [paperCorners.topLeft, paperCorners.topRight, paperCorners.bottomRight, paperCorners.bottomLeft];
              corners.forEach((corner, i) => {
                canvasCtx.fillStyle = "#00FF00";
                canvasCtx.beginPath();
                canvasCtx.arc(corner.x, corner.y, 5, 0, Math.PI * 2);
                canvasCtx.fill();
              });

              // Draw key regions
              // DON'T flip coordinates - CSS mirroring handles it automatically
              const noteNames = ["C", "D", "E", "F", "G", "A", "B", "C", "D", "E"];
              keyRegions.forEach((keyRegion, i) => {
                // Check if this key is currently pressed
                const isPressed = Array.from(activeKeysRef.current.values()).includes(keyRegion.noteIndex);
                
                // Draw key region (subtle background) - use raw coordinates
                // Make rectangle borders more subtle to show spacing better
                canvasCtx.fillStyle = isPressed 
                  ? "rgba(255, 255, 0, 0.15)" 
                  : "rgba(255, 255, 255, 0.05)"; // More transparent to show spacing
                canvasCtx.fillRect(keyRegion.x, keyRegion.y, keyRegion.width, keyRegion.height);
                
                // Draw key border (more subtle to show spacing)
                canvasCtx.strokeStyle = isPressed ? "rgba(255, 255, 0, 0.6)" : "rgba(0, 255, 0, 0.3)";
                canvasCtx.lineWidth = 1.5;
                canvasCtx.strokeRect(keyRegion.x, keyRegion.y, keyRegion.width, keyRegion.height);
                
                // Draw elliptical hitbox (better than circle for piano keys) - BLUE ELLIPSE
                // Ellipse is wider horizontally, matching the key shape better
                
                // Draw hitbox ellipse - use raw coordinates
                canvasCtx.fillStyle = isPressed 
                  ? "rgba(0, 150, 255, 0.6)" // Bright blue when pressed
                  : "rgba(0, 150, 255, 0.3)"; // Semi-transparent blue when not pressed
                canvasCtx.beginPath();
                canvasCtx.ellipse(
                  keyRegion.hitboxCenterX,
                  keyRegion.hitboxCenterY,
                  keyRegion.hitboxRadiusX,
                  keyRegion.hitboxRadiusY,
                  0, // rotation
                  0, // start angle
                  Math.PI * 2 // end angle
                );
                canvasCtx.fill();
                
                // Draw hitbox border
                canvasCtx.strokeStyle = isPressed ? "#00AAFF" : "#0099FF";
                canvasCtx.lineWidth = 2;
                canvasCtx.stroke();
                
                // Draw note label (smaller, above hitbox)
                canvasCtx.fillStyle = "#FFFFFF";
                canvasCtx.font = "bold 16px Arial";
                canvasCtx.textAlign = "center";
                canvasCtx.fillText(
                  noteNames[i],
                  keyRegion.hitboxCenterX,
                  keyRegion.hitboxCenterY - keyRegion.hitboxRadiusY - 8
                );
              });
            };

            // Process hand detection and piano key presses (only when paper is detected)
            if (paperDetectorRef.current?.isDetected()) {
              if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                const currentTime = performance.now();

                results.multiHandLandmarks.forEach((landmarks: any[], handIndex: number) => {
                  // Get index finger tip (landmark 8) - MediaPipe provides x, y, z coordinates
                  const indexTipLandmark = landmarks[8];
                  const indexTipZ = indexTipLandmark.z || 0; // Z depth: negative = closer to camera
                  
                  // COORDINATE SYSTEM (FIXED):
                  // - MediaPipe processes RAW video: coordinates in raw space (x=0 = left in raw video)
                  // - Canvas is CSS-mirrored: everything drawn is automatically mirrored visually
                  // - Paper detection works on raw buffer: coordinates in raw space
                  // - Paper is drawn in RAW coordinates: CSS mirroring handles the visual flip
                  //
                  // Solution: Use RAW coordinates for both detection and drawing
                  // CSS mirroring will flip both paper and finger visually, so they stay aligned
                  const rawFingerX = indexTipLandmark.x * canvasWidth;
                  const rawFingerY = indexTipLandmark.y * canvasHeight;
                  
                  // Get which key the finger is pointing at (using raw coordinates - both paper and finger are in raw space)
                  const keyIndex = paperDetectorRef.current!.getKeyAtPosition(rawFingerX, rawFingerY);
                  
                  // For display, flip coordinates so it matches the mirrored video
                  const indexTip = toPixelCoords(indexTipLandmark.x, indexTipLandmark.y);
                  
                  // Debug: log finger position and key detection (less verbose)
                  // Uncomment for debugging:
                  // if (keyIndex !== null) {
                  //   console.log(`🎹 Finger at (${indexTip.x.toFixed(0)}, ${indexTip.y.toFixed(0)}) over key ${keyIndex}, Z=${indexTipZ.toFixed(3)}`);
                  // }
                  
                  if (keyIndex === null) {
                    // Finger not over any key
                    const currentlyPressingKey = activeKeysRef.current.get(handIndex);
                    if (currentlyPressingKey !== undefined) {
                      activeKeysRef.current.delete(handIndex);
                    }
                    return;
                  }
                  
                  // Check if finger is touching the paper (using Z-depth)
                  // Make threshold less strict - try different values
                  const isTouchingPaper = paperDetectorRef.current!.isTouchingPaper(indexTipZ, Z_TOUCH_THRESHOLD);
                  
                  // Check if finger is close enough to paper to trigger
                  // Z gets more negative as finger gets closer to camera
                  // Using a more lenient threshold so it's easier to trigger
                  const isClose = indexTipZ < Z_TOUCH_THRESHOLD;
                  
                  // Check if this key is already being pressed by this hand
                  const currentlyPressingKey = activeKeysRef.current.get(handIndex);
                  
                  // Check cooldown for this hand-key combination
                  const cooldownKey = `${handIndex}-${keyIndex}`;
                  const lastPressTime = keyCooldownRef.current.get(cooldownKey) || 0;
                  const keyCooldownPassed = currentTime - lastPressTime > KEY_COOLDOWN_MS;
                  
                  // Check global cooldown for this hand (prevents rapid switching between keys)
                  const lastHandPressTime = handCooldownRef.current.get(handIndex) || 0;
                  const globalCooldownPassed = currentTime - lastHandPressTime > GLOBAL_COOLDOWN_MS;

                  // Play note when:
                  // 1. Finger is over a key
                  // 2. Finger is close/touching paper (Z-depth indicates contact)
                  // 3. Not already pressing this key (avoid retriggering)
                  // 4. Key-specific cooldown has passed (prevents same key double-trigger)
                  // 5. Global hand cooldown has passed (prevents rapid key switching)
                  if (isClose && currentlyPressingKey !== keyIndex && keyCooldownPassed && globalCooldownPassed) {
                    // Play the piano note
                    if (pianoRef.current) {
                      const noteName = pianoRef.current.getNotes()[keyIndex];
                      console.log(`🎹 ✅ TRIGGER: Playing key ${keyIndex} (${noteName}) - Z=${indexTipZ.toFixed(3)}`);
                      pianoRef.current.playNote(keyIndex);
                    } else {
                      console.error("❌ Piano ref is null!");
                    }
                    
                    // Mark this key as active for this hand
                    activeKeysRef.current.set(handIndex, keyIndex);
                    
                    // Set cooldowns
                    keyCooldownRef.current.set(cooldownKey, currentTime);
                    handCooldownRef.current.set(handIndex, currentTime);
                  }
                  
                  // Release key when finger moves away from paper or moves to a different key
                  // Use timestamp-based delay to prevent immediate re-trigger
                  const RELEASE_DELAY_MS = 50; // Delay before key can be re-triggered after release
                  
                  if (currentlyPressingKey !== undefined) {
                    if (!isClose) {
                      // Finger moved away from paper - mark release time and release after delay
                      const releaseTime = keyReleaseTimeRef.current.get(handIndex) || 0;
                      if (releaseTime === 0) {
                        // First frame where finger moved away - mark release time
                        keyReleaseTimeRef.current.set(handIndex, currentTime);
                      } else if (currentTime - releaseTime > RELEASE_DELAY_MS) {
                        // Enough time has passed - actually release the key
                        activeKeysRef.current.delete(handIndex);
                        keyReleaseTimeRef.current.delete(handIndex);
                      }
                    } else if (keyIndex !== currentlyPressingKey) {
                      // Finger moved to a different key - release previous key immediately
                      activeKeysRef.current.delete(handIndex);
                      keyReleaseTimeRef.current.delete(handIndex);
                    } else {
                      // Finger is still on the same key and close - clear release timer
                      keyReleaseTimeRef.current.delete(handIndex);
                    }
                  }
                });
              }
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

            // Try automatic paper detection periodically (every 60 frames = ~2 seconds at 30fps)
            // Edge detection is expensive, so run less frequently
            if (!paperDetectorRef.current?.isDetected()) {
              detectionFrameCountRef.current++;
              if (detectionFrameCountRef.current % 60 === 0) {
                try {
                  // Get image data from the current frame
                  const imageData = canvasCtx.getImageData(0, 0, canvasWidth, canvasHeight);
                  const detected = paperDetectorRef.current?.detectPaper(imageData, canvasWidth, canvasHeight);
                  if (detected) {
                    setPaperDetected(true);
                    console.log("✅ Paper detected automatically! Key regions:", paperDetectorRef.current?.getKeyRegions().length);
                  } else {
                    console.log("⏳ Detection attempt", detectionFrameCountRef.current / 30, "- no paper found yet");
                  }
                } catch (error) {
                  console.error("❌ Detection error:", error);
                }
              }
            }

            // Draw paper piano (paper outline and key regions)
            drawPaperPiano();

            // Draw hand landmarks and highlight index finger
            if (results.multiHandLandmarks) {
              results.multiHandLandmarks.forEach((landmarks: any[], handIndex: number) => {
                // Draw connections - use raw coordinates, CSS mirroring handles visual flip
                drawConnections(canvasCtx, landmarks, HAND_CONNECTIONS, canvasWidth, false);
                
                // Draw all landmarks - use raw coordinates, CSS mirroring handles visual flip
                drawLandmarks(canvasCtx, landmarks, {
                  color: "#00FF00",
                  lineWidth: 2,
                }, canvasWidth, false);
                
                // Highlight index finger tip (landmark 8) - the "piano finger"
                const indexTipLandmark = landmarks[8];
                const indexTipZ = indexTipLandmark.z || 0;
                
                // Use raw coordinates for finger display - CSS mirroring handles the visual flip
                const indexTip = {
                  x: indexTipLandmark.x * canvasWidth,
                  y: indexTipLandmark.y * canvasHeight,
                };
                
                // Get key if paper is detected (this is just for visualization display)
                // Note: Actual key detection happens in the processing loop above
                let keyIndex: number | null = null;
                let isClose = false;
                if (paperDetectorRef.current?.isDetected()) {
                  // Use raw coordinates for detection
                  keyIndex = paperDetectorRef.current.getKeyAtPosition(indexTip.x, indexTip.y);
                  isClose = indexTipZ < Z_TOUCH_THRESHOLD;
                }
                
                // Draw index finger tip with special highlight
                canvasCtx.fillStyle = isClose ? "#FF0000" : "#FFFF00";
                canvasCtx.beginPath();
                canvasCtx.arc(indexTip.x, indexTip.y, 12, 0, Math.PI * 2);
                canvasCtx.fill();
                canvasCtx.strokeStyle = "#FFFFFF";
                canvasCtx.lineWidth = 2;
                canvasCtx.stroke();
                
                // Draw line from finger to hitbox circle if over paper (like reference project)
                if (keyIndex !== null && paperDetectorRef.current?.isDetected()) {
                  const keyRegions = paperDetectorRef.current.getKeyRegions();
                  const keyRegion = keyRegions[keyIndex];
                  
                  // Draw line from finger to hitbox center (both in raw coordinates)
                  canvasCtx.strokeStyle = isClose ? "rgba(0, 255, 0, 0.8)" : "rgba(255, 255, 255, 0.3)";
                  canvasCtx.lineWidth = isClose ? 3 : 2;
                  canvasCtx.setLineDash(isClose ? [] : [5, 5]);
                  canvasCtx.beginPath();
                  canvasCtx.moveTo(indexTip.x, indexTip.y);
                  canvasCtx.lineTo(keyRegion.hitboxCenterX, keyRegion.hitboxCenterY);
                  canvasCtx.stroke();
                  canvasCtx.setLineDash([]);
                }
                
                // Show key and Z-depth info
                if (paperDetectorRef.current?.isDetected()) {
                  canvasCtx.fillStyle = "#FFFFFF";
                  canvasCtx.font = "bold 14px Arial";
                  canvasCtx.textAlign = "left";
                  const noteNames = ["C", "D", "E", "F", "G", "A", "B", "C", "D", "E"];
                  if (keyIndex !== null) {
                    canvasCtx.fillText(
                      `Key: ${noteNames[keyIndex]} ${isClose ? "(TOUCHING)" : ""}`,
                      indexTip.x + 15,
                      indexTip.y - 20
                    );
                  }
                  canvasCtx.fillText(
                    `Z: ${indexTipZ.toFixed(3)} ${isClose ? "✓ CLOSE" : "✗ FAR"}`,
                    indexTip.x + 15,
                    indexTip.y - 5
                  );
                  canvasCtx.fillText(
                    `Pos: (${indexTip.x.toFixed(0)}, ${indexTip.y.toFixed(0)})`,
                    indexTip.x + 15,
                    indexTip.y + 10
                  );
                }
              });
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
      if (pianoRef.current) {
        pianoRef.current.dispose();
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
      if (pianoRef.current) {
        console.log("🎹 Starting camera - initializing piano...");
        await pianoRef.current.initialize();
        console.log("🎹 Piano initialization complete");
      } else {
        console.error("❌ Piano ref is null in startCamera!");
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

  // Handle manual detection trigger (press 'D' to force detection)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!isActive) return;

      // Force detection with 'D'
      if (e.key === 'd' || e.key === 'D') {
        if (canvasRef.current && paperDetectorRef.current) {
          const canvasCtx = canvasRef.current.getContext("2d");
          if (canvasCtx) {
            const imageData = canvasCtx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
            const detected = paperDetectorRef.current.detectPaper(
              imageData,
              canvasRef.current.width,
              canvasRef.current.height
            );
            if (detected) {
              setPaperDetected(true);
              console.log("✅ Paper detected!");
            } else {
              console.log("❌ Paper not detected. Try placing a white paper on a contrasting background.");
            }
          }
        }
      }

      // Reset detection with 'R'
      if (e.key === 'r' || e.key === 'R') {
        if (paperDetectorRef.current) {
          paperDetectorRef.current.reset();
          setPaperDetected(false);
          console.log("🔄 Detection reset");
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isActive]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-8 py-16 px-8">
        <h1 className="text-4xl font-bold text-black dark:text-zinc-50">
          🎹 Air Piano
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Place a white paper on your table - it will be detected automatically and divided into 8 keys
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
          <button
            onClick={async () => {
              if (pianoRef.current) {
                console.log("🎹 Test button - playing C4");
                await pianoRef.current.initialize();
                pianoRef.current.playNote(0); // Play C
              } else {
                console.error("Piano not initialized");
              }
            }}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-blue-600 px-8 text-white transition-colors hover:bg-blue-700 font-medium"
          >
            Test Sound (C)
          </button>
          <button
            onClick={() => {
              if (canvasRef.current && paperDetectorRef.current) {
                const canvasCtx = canvasRef.current.getContext("2d");
                if (canvasCtx) {
                  const imageData = canvasCtx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
                  const detected = paperDetectorRef.current.detectPaper(
                    imageData,
                    canvasRef.current.width,
                    canvasRef.current.height
                  );
                  if (detected) {
                    setPaperDetected(true);
                    console.log("✅ Paper detected!");
                  } else {
                    console.log("❌ Paper not detected. Make sure paper is visible and has good contrast.");
                  }
                }
              }
            }}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-green-600 px-8 text-white transition-colors hover:bg-green-700 font-medium"
          >
            Detect Paper (D)
          </button>
          <button
            onClick={() => {
              if (paperDetectorRef.current) {
                paperDetectorRef.current.reset();
                setPaperDetected(false);
                console.log("🔄 Detection reset");
              }
            }}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-orange-600 px-8 text-white transition-colors hover:bg-orange-700 font-medium"
          >
            Reset (R)
          </button>
        </div>
        {paperDetected && paperDetectorRef.current?.isDetected() && (
          <div className="mt-4 p-4 bg-green-100 dark:bg-green-900 rounded-lg">
            <p className="font-bold text-green-800 dark:text-green-200">
              ✅ Paper Detected - Ready to Play!
            </p>
            <p className="text-sm text-green-700 dark:text-green-300 mt-2">
              Point your finger at the keys on the paper and touch them to play notes. Move your finger closer to the paper to trigger.
            </p>
          </div>
        )}
        {!paperDetected && (
          <div className="mt-4 p-4 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
            <p className="font-bold text-yellow-800 dark:text-yellow-200">
              📄 Waiting for Paper Detection
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-2">
              Place a white paper on your table with good lighting. Detection happens automatically, or press 'D' to force detection.
            </p>
          </div>
        )}
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg max-w-2xl">
          <p className="font-bold text-blue-800 dark:text-blue-200 mb-2">How to Use:</p>
          <ol className="text-sm text-blue-700 dark:text-blue-300 list-decimal list-inside space-y-1">
            <li>Place a white paper on your table (better detection with good contrast)</li>
            <li>Start the camera</li>
            <li>Paper will be detected automatically, or press 'D' to force detection</li>
            <li>Paper will be divided into 8 keys automatically</li>
            <li>Point your finger at keys on the paper</li>
            <li>Move your finger closer to the paper (lower Z value) to trigger notes</li>
            <li>Press 'R' to reset detection if needed</li>
          </ol>
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
  connections: number[][],
  canvasWidth: number,
  flipForDisplay: boolean = false
) {
  ctx.strokeStyle = "#00FF00";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const connection of connections) {
    const start = landmarks[connection[0]];
    const end = landmarks[connection[1]];
    // Use raw coordinates - CSS mirroring handles visual flip
    const startX = start.x * canvasWidth;
    const startY = start.y * ctx.canvas.height;
    const endX = end.x * canvasWidth;
    const endY = end.y * ctx.canvas.height;
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
  }
  ctx.stroke();
}

function drawLandmarks(
  ctx: CanvasRenderingContext2D,
  landmarks: any[],
  style: { color: string; lineWidth: number },
  canvasWidth: number,
  flipForDisplay: boolean = false
) {
  ctx.fillStyle = style.color;
  for (const landmark of landmarks) {
    // Use raw coordinates - CSS mirroring handles visual flip
    const x = landmark.x * canvasWidth;
    const y = landmark.y * ctx.canvas.height;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, 2 * Math.PI);
    ctx.fill();
  }
}

