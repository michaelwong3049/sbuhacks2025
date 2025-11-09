"use client";

import { useEffect, useRef, useState } from "react";
import { Triangle } from "@/app/lib/sound/triangle";

type HandsType = {
  setOptions: (options: any) => void;
  onResults: (callback: (results: any) => void) => void;
  send: (data: { image: HTMLVideoElement }) => Promise<void>;
  close: () => Promise<void>;
};

export default function TrianglePlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isActive, setIsActive] = useState(false);
  const handsRef = useRef<HandsType | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const triangleRef = useRef<Triangle | null>(null);
  
  // Track triangle hits (to avoid double triggers)
  const triangleCooldownRef = useRef<number>(0);
  const TRIANGLE_COOLDOWN_MS = 300; // Minimum time between triangle hits
  
  // Track previous hit state to detect entry (not continuous hits)
  const wasInHitZoneRef = useRef<boolean>(false);
  
  // Track left hand position (for holding triangle)
  const leftHandPositionRef = useRef<{ x: number; y: number } | null>(null);
  const TRIANGLE_SIZE = 150; // Larger triangle
  const TRIANGLE_BAR_WIDTH = 12; // Width of the triangle bar (thickness)
  const TRIANGLE_HIT_DISTANCE = 20; // Distance from edge to trigger hit
  const TRIANGLE_OPENING_SIZE = 30; // Size of the opening (gap) in the triangle

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    // Initialize triangle
    triangleRef.current = new Triangle();
    console.log("🔺 Triangle initialized");

    // Load MediaPipe Hands from CDN
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

            // Clear and draw video frame
            canvasCtx.save();
            canvasCtx.clearRect(0, 0, canvasWidth, canvasHeight);
            canvasCtx.drawImage(
              results.image,
              0,
              0,
              canvasWidth,
              canvasHeight
            );

            // Detect left and right hands, and find holding gesture
            type HandPosition = { x: number; y: number; z: number };
            let leftHandPosition: HandPosition | null = null;
            let rightHandIndexTip: HandPosition | null = null;
            let leftHandIsHolding = false;

            if (results.multiHandLandmarks && results.multiHandedness) {
              // Find left and right hands
              results.multiHandLandmarks.forEach((landmarks: any[], index: number) => {
                const handedness = results.multiHandedness[index];
                const label = handedness?.label?.toLowerCase() || "";
                const indexTip = landmarks[8]; // Index finger tip is landmark 8

                if (label === "left") {
                  // Use the center of the hand (between index and middle finger base) for more natural holding position
                  // Landmark 5 = index finger MCP (base)
                  // Landmark 9 = middle finger MCP (base)
                  const indexBase = landmarks[5] as { x: number; y: number; z?: number };
                  const middleBase = landmarks[9] as { x: number; y: number; z?: number };
                  
                  // Calculate hand center (between index and middle finger bases)
                  const handCenterX = (indexBase.x + middleBase.x) / 2;
                  const handCenterY = (indexBase.y + middleBase.y) / 2;
                  const handCenterZ = ((indexBase.z || 0) + (middleBase.z || 0)) / 2;
                  
                  leftHandPosition = {
                    x: handCenterX * canvasWidth,
                    y: handCenterY * canvasHeight,
                    z: handCenterZ || 0,
                  };

                  // Check if left hand is making a "holding" gesture (closed fist)
                  // Check if fingertips are close to palm (indicating closed hand)
                  const thumbTip = landmarks[4] as { x: number; y: number };
                  const middleTip = landmarks[12] as { x: number; y: number };
                  const ringTip = landmarks[16] as { x: number; y: number };
                  const indexBaseForPalm = landmarks[5] as { x: number; y: number };
                  const pinkyBase = landmarks[17] as { x: number; y: number };
                  
                  // Calculate distances from fingertips to palm center
                  const palmCenterX = (indexBaseForPalm.x + pinkyBase.x) / 2;
                  const palmCenterY = (indexBaseForPalm.y + pinkyBase.y) / 2;
                  
                  const thumbDist = Math.sqrt(
                    Math.pow(thumbTip.x - palmCenterX, 2) + 
                    Math.pow(thumbTip.y - palmCenterY, 2)
                  );
                  const middleDist = Math.sqrt(
                    Math.pow(middleTip.x - palmCenterX, 2) + 
                    Math.pow(middleTip.y - palmCenterY, 2)
                  );
                  const ringDist = Math.sqrt(
                    Math.pow(ringTip.x - palmCenterX, 2) + 
                    Math.pow(ringTip.y - palmCenterY, 2)
                  );

                  // If most fingertips are close to palm, hand is in "holding" position
                  const fingersClose = thumbDist < 0.12 && middleDist < 0.12 && ringDist < 0.12;
                  leftHandIsHolding = fingersClose;
                  
                  if (leftHandIsHolding) {
                    leftHandPositionRef.current = { x: leftHandPosition.x, y: leftHandPosition.y };
                  }
                } else if (label === "right") {
                  const indexTipTyped = indexTip as { x: number; y: number; z?: number };
                  rightHandIndexTip = {
                    x: indexTipTyped.x * canvasWidth,
                    y: indexTipTyped.y * canvasHeight,
                    z: indexTipTyped.z || 0,
                  };
                }
              });
            }

            // Determine triangle position
            let triangleCenterX = canvasWidth / 2;
            let triangleCenterY = canvasHeight / 2;
            
            // If left hand is holding, position triangle below the hand center (between fingers)
            if (leftHandIsHolding && leftHandPosition) {
              const pos = leftHandPosition as HandPosition;
              triangleCenterX = pos.x;
              triangleCenterY = pos.y + TRIANGLE_SIZE * 0.6; // Position below hand (not too far)
              // Keep triangle within canvas bounds
              triangleCenterX = Math.max(TRIANGLE_SIZE / 2, Math.min(canvasWidth - TRIANGLE_SIZE / 2, triangleCenterX));
              triangleCenterY = Math.max(TRIANGLE_SIZE / 2, Math.min(canvasHeight - TRIANGLE_SIZE / 2, triangleCenterY));
            }

            // Calculate triangle vertices (equilateral triangle)
            const topX = triangleCenterX;
            const topY = triangleCenterY - TRIANGLE_SIZE / 2;
            const bottomLeftX = triangleCenterX - TRIANGLE_SIZE / 2;
            const bottomLeftY = triangleCenterY + TRIANGLE_SIZE / 2;
            const bottomRightX = triangleCenterX + TRIANGLE_SIZE / 2;
            const bottomRightY = triangleCenterY + TRIANGLE_SIZE / 2;

            // Helper function to calculate distance from point to line segment
            const distanceToLineSegment = (
              px: number, py: number,
              x1: number, y1: number,
              x2: number, y2: number
            ): number => {
              const dx = x2 - x1;
              const dy = y2 - y1;
              const lengthSquared = dx * dx + dy * dy;
              
              if (lengthSquared === 0) {
                // Line segment is actually a point
                return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
              }
              
              // Calculate t (parameter along the line segment)
              const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
              
              // Find closest point on line segment
              const closestX = x1 + t * dx;
              const closestY = y1 + t * dy;
              
              // Return distance to closest point
              return Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
            };

            // Store triangle edges for hit detection (with opening)
            // Edge 1: Top to bottom-left (but with opening near bottom-left)
            // Edge 2: Bottom-left to bottom-right (full edge)
            // Edge 3: Bottom-right to top (but with opening near bottom-right)
            const edge1Start = { x: topX, y: topY };
            const edge1End = { 
              x: bottomLeftX + TRIANGLE_OPENING_SIZE * 0.6, 
              y: bottomLeftY - TRIANGLE_OPENING_SIZE * 0.4 
            };
            
            const edge2Start = { 
              x: bottomLeftX + TRIANGLE_OPENING_SIZE * 0.6, 
              y: bottomLeftY - TRIANGLE_OPENING_SIZE * 0.4 
            };
            const edge2End = { 
              x: bottomRightX - TRIANGLE_OPENING_SIZE * 0.6, 
              y: bottomRightY - TRIANGLE_OPENING_SIZE * 0.4 
            };
            
            const edge3Start = { 
              x: bottomRightX - TRIANGLE_OPENING_SIZE * 0.6, 
              y: bottomRightY - TRIANGLE_OPENING_SIZE * 0.4 
            };
            const edge3End = { x: topX, y: topY };

            // Draw triangle (only if left hand is holding or no hands detected)
            if (leftHandIsHolding || leftHandPosition === null) {
              // Draw triangle shadow (for depth)
              canvasCtx.strokeStyle = "rgba(0, 0, 0, 0.4)";
              canvasCtx.lineWidth = TRIANGLE_BAR_WIDTH + 2;
              canvasCtx.lineCap = "round";
              canvasCtx.lineJoin = "round";
              canvasCtx.shadowColor = "rgba(0, 0, 0, 0.5)";
              canvasCtx.shadowBlur = 5;
              canvasCtx.shadowOffsetX = 3;
              canvasCtx.shadowOffsetY = 3;
              
              // Draw triangle bar (hollow, with opening)
              canvasCtx.beginPath();
              canvasCtx.moveTo(edge1Start.x, edge1Start.y);
              canvasCtx.lineTo(edge1End.x, edge1End.y);
              // Gap (opening) - don't draw
              canvasCtx.moveTo(edge2Start.x, edge2Start.y);
              canvasCtx.lineTo(edge2End.x, edge2End.y);
              // Gap (opening) - don't draw
              canvasCtx.moveTo(edge3Start.x, edge3Start.y);
              canvasCtx.lineTo(edge3End.x, edge3End.y);
              canvasCtx.stroke();
              
              // Reset shadow
              canvasCtx.shadowOffsetX = 0;
              canvasCtx.shadowOffsetY = 0;
              canvasCtx.shadowBlur = 0;
              
              // Draw triangle bar with metallic gradient and 3D effect
              const gradient = canvasCtx.createLinearGradient(
                topX, topY,
                triangleCenterX, bottomLeftY
              );
              gradient.addColorStop(0, "#FFD700"); // Bright gold
              gradient.addColorStop(0.5, "#FFA500"); // Medium gold
              gradient.addColorStop(1, "#DAA520"); // Darker gold
              
              canvasCtx.strokeStyle = gradient;
              canvasCtx.lineWidth = TRIANGLE_BAR_WIDTH;
              canvasCtx.lineCap = "round";
              canvasCtx.lineJoin = "round";
              canvasCtx.shadowColor = "rgba(255, 215, 0, 0.6)";
              canvasCtx.shadowBlur = 8;
              
              // Draw the three edges with opening
              canvasCtx.beginPath();
              // Edge 1: Top to near bottom-left (with opening)
              canvasCtx.moveTo(edge1Start.x, edge1Start.y);
              canvasCtx.lineTo(edge1End.x, edge1End.y);
              canvasCtx.stroke();
              
              // Edge 2: Bottom edge (full)
              canvasCtx.beginPath();
              canvasCtx.moveTo(edge2Start.x, edge2Start.y);
              canvasCtx.lineTo(edge2End.x, edge2End.y);
              canvasCtx.stroke();
              
              // Edge 3: Near bottom-right to top (with opening)
              canvasCtx.beginPath();
              canvasCtx.moveTo(edge3Start.x, edge3Start.y);
              canvasCtx.lineTo(edge3End.x, edge3End.y);
              canvasCtx.stroke();
              
              // Reset shadow
              canvasCtx.shadowBlur = 0;
              
              // Draw inner highlight for 3D effect (on each edge)
              canvasCtx.strokeStyle = "rgba(255, 255, 255, 0.5)";
              canvasCtx.lineWidth = 3;
              canvasCtx.lineCap = "round";
              
              // Highlight edge 1
              canvasCtx.beginPath();
              canvasCtx.moveTo(edge1Start.x * 0.95 + edge1End.x * 0.05, edge1Start.y * 0.95 + edge1End.y * 0.05);
              canvasCtx.lineTo(edge1Start.x * 0.7 + edge1End.x * 0.3, edge1Start.y * 0.7 + edge1End.y * 0.3);
              canvasCtx.stroke();
              
              // Highlight edge 2
              canvasCtx.beginPath();
              canvasCtx.moveTo(edge2Start.x * 0.9 + edge2End.x * 0.1, edge2Start.y * 0.9 + edge2End.y * 0.1);
              canvasCtx.lineTo(edge2Start.x * 0.5 + edge2End.x * 0.5, edge2Start.y * 0.5 + edge2End.y * 0.5);
              canvasCtx.stroke();
              
              // Highlight edge 3
              canvasCtx.beginPath();
              canvasCtx.moveTo(edge3Start.x * 0.95 + edge3End.x * 0.05, edge3Start.y * 0.95 + edge3End.y * 0.05);
              canvasCtx.lineTo(edge3Start.x * 0.7 + edge3End.x * 0.3, edge3Start.y * 0.7 + edge3End.y * 0.3);
              canvasCtx.stroke();
              
              // Draw hanging string/rope at top
              canvasCtx.strokeStyle = "#8B7355"; // Brown rope color
              canvasCtx.lineWidth = 4;
              canvasCtx.shadowBlur = 0;
              canvasCtx.beginPath();
              canvasCtx.moveTo(topX, topY);
              canvasCtx.lineTo(topX, topY - 20);
              canvasCtx.stroke();
              
              // Draw small loop at top of string
              canvasCtx.fillStyle = "#654321";
              canvasCtx.beginPath();
              canvasCtx.arc(topX, topY - 20, 5, 0, Math.PI * 2);
              canvasCtx.fill();
            }

            // Draw left hand (holding indicator)
            if (leftHandPosition) {
              const pos = leftHandPosition as HandPosition;
              const holdingColor = leftHandIsHolding ? "#00FF00" : "#FFA500";
              canvasCtx.fillStyle = holdingColor;
              canvasCtx.beginPath();
              canvasCtx.arc(pos.x, pos.y, 18, 0, Math.PI * 2);
              canvasCtx.fill();
              canvasCtx.strokeStyle = "#FFFFFF";
              canvasCtx.lineWidth = 3;
              canvasCtx.stroke();
              
              // Draw label
              canvasCtx.fillStyle = "#FFFFFF";
              canvasCtx.font = "bold 16px Arial";
              canvasCtx.textAlign = "center";
              canvasCtx.fillText(
                leftHandIsHolding ? "HOLDING ✓" : "Make a fist",
                pos.x,
                pos.y - 30
              );
            }

            // Process right hand for hitting triangle
            if (rightHandIndexTip && (leftHandIsHolding || !leftHandPosition)) {
              const tip = rightHandIndexTip as HandPosition;
              const currentTime = performance.now();
              const fingerX = tip.x;
              const fingerY = tip.y;
              const fingerZ = tip.z;

              // Calculate distance from finger to each triangle edge
              const distToEdge1 = distanceToLineSegment(
                fingerX, fingerY,
                edge1Start.x, edge1Start.y,
                edge1End.x, edge1End.y
              );
              const distToEdge2 = distanceToLineSegment(
                fingerX, fingerY,
                edge2Start.x, edge2Start.y,
                edge2End.x, edge2End.y
              );
              const distToEdge3 = distanceToLineSegment(
                fingerX, fingerY,
                edge3Start.x, edge3Start.y,
                edge3End.x, edge3End.y
              );
              
              // Find minimum distance to any edge
              const minDistanceToEdge = Math.min(distToEdge1, distToEdge2, distToEdge3);
              
              // Check if finger is close to any edge and close enough in Z-depth
              const isCloseToEdge = minDistanceToEdge <= TRIANGLE_HIT_DISTANCE;
              const isClose = fingerZ < -0.015; // Finger is close to camera/screen
              const isInHitZone = isCloseToEdge && isClose;
              
              // Only trigger when entering the hit zone (transition from not in zone to in zone)
              const justEnteredHitZone = isInHitZone && !wasInHitZoneRef.current;
              const cooldownPassed = currentTime - triangleCooldownRef.current > TRIANGLE_COOLDOWN_MS;

              // Update previous state
              wasInHitZoneRef.current = isInHitZone;

              // Draw right hand finger position with visual feedback
              if (isInHitZone) {
                // Glowing red when in hit zone
                canvasCtx.shadowColor = "#FF0000";
                canvasCtx.shadowBlur = 15;
                canvasCtx.fillStyle = "#FF0000";
              } else {
                canvasCtx.shadowBlur = 0;
                canvasCtx.fillStyle = "#FFFF00";
              }
              canvasCtx.beginPath();
              canvasCtx.arc(fingerX, fingerY, 18, 0, Math.PI * 2);
              canvasCtx.fill();
              canvasCtx.strokeStyle = "#FFFFFF";
              canvasCtx.lineWidth = 3;
              canvasCtx.stroke();
              canvasCtx.shadowBlur = 0;

              // Draw line from finger to closest edge when close to triangle
              if (isCloseToEdge) {
                // Find which edge is closest
                let closestEdgeX = triangleCenterX;
                let closestEdgeY = triangleCenterY;
                
                if (minDistanceToEdge === distToEdge1) {
                  // Calculate closest point on edge 1
                  const dx = edge1End.x - edge1Start.x;
                  const dy = edge1End.y - edge1Start.y;
                  const t = Math.max(0, Math.min(1, 
                    ((fingerX - edge1Start.x) * dx + (fingerY - edge1Start.y) * dy) / (dx * dx + dy * dy)
                  ));
                  closestEdgeX = edge1Start.x + t * dx;
                  closestEdgeY = edge1Start.y + t * dy;
                } else if (minDistanceToEdge === distToEdge2) {
                  const dx = edge2End.x - edge2Start.x;
                  const dy = edge2End.y - edge2Start.y;
                  const t = Math.max(0, Math.min(1, 
                    ((fingerX - edge2Start.x) * dx + (fingerY - edge2Start.y) * dy) / (dx * dx + dy * dy)
                  ));
                  closestEdgeX = edge2Start.x + t * dx;
                  closestEdgeY = edge2Start.y + t * dy;
                } else {
                  const dx = edge3End.x - edge3Start.x;
                  const dy = edge3End.y - edge3Start.y;
                  const t = Math.max(0, Math.min(1, 
                    ((fingerX - edge3Start.x) * dx + (fingerY - edge3Start.y) * dy) / (dx * dx + dy * dy)
                  ));
                  closestEdgeX = edge3Start.x + t * dx;
                  closestEdgeY = edge3Start.y + t * dy;
                }
                
                canvasCtx.strokeStyle = isClose ? "rgba(255, 0, 0, 0.9)" : "rgba(255, 255, 255, 0.6)";
                canvasCtx.lineWidth = isClose ? 4 : 2;
                canvasCtx.setLineDash(isClose ? [] : [8, 8]);
                canvasCtx.beginPath();
                canvasCtx.moveTo(fingerX, fingerY);
                canvasCtx.lineTo(closestEdgeX, closestEdgeY);
                canvasCtx.stroke();
                canvasCtx.setLineDash([]);
              }

              // Play triangle only when ENTERING the hit zone (hitting the edge)
              if (justEnteredHitZone && cooldownPassed) {
                if (triangleRef.current) {
                  console.log("🔺 HIT! Playing triangle - distance to edge:", minDistanceToEdge.toFixed(1), "Z:", fingerZ.toFixed(3));
                  triangleRef.current.play();
                  triangleCooldownRef.current = currentTime;
                } else {
                  console.error("❌ Triangle ref is null!");
                }
              }
            } else {
              // Reset hit zone state when no right hand is detected
              wasInHitZoneRef.current = false;
            }

            // Draw hand landmarks (subtle, only for right hand)
            if (results.multiHandLandmarks && results.multiHandedness) {
              results.multiHandLandmarks.forEach((landmarks: any[], index: number) => {
                const handedness = results.multiHandedness[index];
                const label = handedness?.label?.toLowerCase() || "";
                
                // Only draw landmarks for right hand (playing hand)
                if (label === "right") {
                  canvasCtx.strokeStyle = "rgba(0, 255, 0, 0.4)";
                  canvasCtx.lineWidth = 1;
                  landmarks.forEach((landmark: any) => {
                    const x = landmark.x * canvasWidth;
                    const y = landmark.y * canvasHeight;
                    canvasCtx.beginPath();
                    canvasCtx.arc(x, y, 2, 0, Math.PI * 2);
                    canvasCtx.fill();
                  });
                }
              });
            }

            // Draw instructions
            canvasCtx.fillStyle = "rgba(255, 255, 255, 0.95)";
            canvasCtx.font = "bold 20px Arial";
            canvasCtx.textAlign = "center";
            canvasCtx.fillStyle = "rgba(255, 255, 255, 0.95)";
            
            if (leftHandPosition === null) {
              canvasCtx.fillText(
                "👈 Make a fist with your LEFT hand to hold the triangle",
                canvasWidth / 2,
                30
              );
            } else if (!leftHandIsHolding) {
              canvasCtx.fillText(
                "👈 Close your LEFT hand into a fist to hold the triangle",
                canvasWidth / 2,
                30
              );
            } else {
              canvasCtx.fillText(
                "👉 Use your RIGHT hand to hit the triangle edges",
                canvasWidth / 2,
                30
              );
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
      if (triangleRef.current) {
        triangleRef.current.dispose();
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
      if (triangleRef.current) {
        console.log("🔺 Starting camera - initializing triangle...");
        try {
          await triangleRef.current.initialize();
          console.log("🔺 Triangle initialization complete");
        } catch (error) {
          console.error("❌ Error initializing triangle:", error);
        }
      } else {
        console.error("❌ Triangle ref is null in startCamera!");
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
    <div className="w-full max-w-2xl flex flex-col items-center gap-6 p-8">
      <div className="w-full aspect-video rounded-lg border-2 border-zinc-300 dark:border-zinc-700 overflow-hidden bg-black relative">
        <video
          ref={videoRef}
          className="w-full h-full object-cover transform scale-x-[-1]"
          style={{ display: "none" }}
          playsInline
        />
        <canvas
          ref={canvasRef}
          className="w-full h-full object-cover transform scale-x-[-1]"
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
            if (triangleRef.current) {
              console.log("🔺 Test button - playing triangle");
              await triangleRef.current.initialize();
              triangleRef.current.play();
            } else {
              console.error("Triangle not initialized");
            }
          }}
          className="flex h-12 items-center justify-center gap-2 rounded-full bg-blue-600 px-8 text-white transition-colors hover:bg-blue-700 font-medium"
        >
          Test Triangle
        </button>
      </div>

      <div className="w-full p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
        <p className="font-bold text-blue-800 dark:text-blue-200 mb-2">How to Use:</p>
        <ol className="text-sm text-blue-700 dark:text-blue-300 list-decimal list-inside space-y-1">
          <li>Start the camera</li>
          <li>Make a fist with your LEFT hand to hold the triangle</li>
          <li>Use your RIGHT hand index finger to hit the triangle edges</li>
          <li>Move your finger closer to the camera (lower Z-depth) to hit the triangle</li>
          <li>The triangle will ring with a metallic sound when you hit the edges</li>
          <li>There's a 300ms cooldown between hits to prevent double-triggering</li>
        </ol>
      </div>
    </div>
  );
}

