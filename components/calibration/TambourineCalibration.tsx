"use client";

import React, { useEffect, useRef, useState } from "react";

export default function TambourineCalibration({
  handPositions,
  isCameraActive = false,
  onAssign,
}: {
  handPositions: {
    left?: { x: number; y: number };
    right?: { x: number; y: number };
  };
  isCameraActive?: boolean;
  onAssign?: (assignment: {
    holder: "left" | "right";
    striker: "left" | "right";
  }) => void;
}) {
  // For tambourine: require both hands roughly near chest height and not too far apart
  const left = handPositions.left;
  const right = handPositions.right;

  // role selections
  const [selectedHolder, setSelectedHolder] = useState<"left" | "right" | null>(
    null
  );
  const [selectedStriker, setSelectedStriker] = useState<
    "left" | "right" | null
  >(null);

  // helper to get pos by role
  const posFor = (role: "left" | "right" | null) =>
    role === "left" ? left : role === "right" ? right : undefined;

  // keep original generic guidance helper
  const guidanceFor = (
    hand: "left" | "right",
    p?: { x: number; y: number }
  ) => {
    if (!p) return `${hand === "left" ? "Left" : "Right"} hand not detected`;
    const msgs: string[] = [];
    if (p.y <= 0.25) msgs.push("Move lower");
    if (p.y >= 0.7) msgs.push("Move higher");
    return msgs.length
      ? msgs.join(", ")
      : `${hand === "left" ? "Left" : "Right"} hand good`;
  };

  // thresholds for "holding" position
  const holdYMin = 0.25;
  const holdYMax = 0.7;

  // Determine whether each hand is in the basic chest/hold range
  const leftInHoldRange = !!left && left.y > holdYMin && left.y < holdYMax;
  const rightInHoldRange = !!right && right.y > holdYMin && right.y < holdYMax;

  // Enforce role-specific calibration rules:
  // - The selected holder must be in the hold range.
  // - The selected striker (open hand) must NOT be in the holder range (prevents "shaking" on the open hand).
  const holderPos = posFor(selectedHolder);
  const strikerPos = posFor(selectedStriker);

  const holderGood =
    selectedHolder !== null &&
    !!holderPos &&
    holderPos.y > holdYMin &&
    holderPos.y < holdYMax;

  const strikerNotHolding =
    selectedStriker !== null &&
    (!!strikerPos
      ? !(strikerPos.y > holdYMin && strikerPos.y < holdYMax)
      : false);

  // Only calibrated when both roles are selected and the holder is placed and the striker remains open (not holding)
  const isCalibrated =
    selectedHolder && selectedStriker
      ? holderGood && strikerNotHolding
      : leftInHoldRange && rightInHoldRange; // fallback if roles not chosen yet

  // sequence / timers / stages
  const [sequenceStarted, setSequenceStarted] = useState(false);
  const [locked, setLocked] = useState(false);
  const [stage, setStage] = useState<
    | "idle"
    | "chooseStriker"
    | "placeHands"
    | "showCalibrated"
    | "countdown"
    | "finished"
  >("idle");
  const [countdown, setCountdown] = useState<number | null>(null);

  const holdTimerRef = useRef<number | null>(null);
  const showTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  // move stage forward depending on selections
  useEffect(() => {
    if (locked) return;
    if (!selectedHolder) {
      setStage("idle");
      return;
    }
    // require selecting a striker next
    if (!selectedStriker) {
      setStage("chooseStriker");
      return;
    }
    // both roles chosen -> instruct user to place hands
    setStage("placeHands");
  }, [selectedHolder, selectedStriker, locked]);

  // Start the calibration only when roles are chosen and hands placed correctly
  useEffect(() => {
    if (locked || sequenceStarted) return;
    if (stage !== "placeHands") {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      return;
    }

    if (isCalibrated) {
      // start a short hold countdown to ensure user keeps correct positions
      if (!holdTimerRef.current) {
        holdTimerRef.current = window.setTimeout(
          () => setSequenceStarted(true),
          2000
        ) as unknown as number;
      }
    } else {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    }

    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    };
  }, [isCalibrated, sequenceStarted, locked, stage]);

  useEffect(() => {
    if (!sequenceStarted) return;
    setStage("showCalibrated");
    showTimerRef.current = window.setTimeout(() => {
      setStage("countdown");
      setCountdown(4);
      countdownIntervalRef.current = window.setInterval(() => {
        setCountdown((c) => {
          if (c === null) return null;
          if (c <= 1) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            setStage("finished");
            setLocked(true);
            // inform parent of assignment (holder + striker)
            try {
              if (onAssign && selectedHolder && selectedStriker) {
                onAssign({
                  holder: selectedHolder,
                  striker: selectedStriker,
                });
              }
            } catch (e) {
              // ignore
            }
            return 0;
          }
          return c - 1;
        });
      }, 1000) as unknown as number;
    }, 1200) as unknown as number;

    return () => {
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [sequenceStarted, selectedHolder, selectedStriker, onAssign]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      if (countdownIntervalRef.current)
        clearInterval(countdownIntervalRef.current);
    };
  }, []);

  if (locked) return null;

  if (!isCameraActive) {
    return (
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gray-900/80 rounded-lg" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white px-6">
            <h3 className="text-xl font-semibold mb-2">Camera Not Active</h3>
            <p className="text-sm text-gray-300 mb-4">
              Click "Start Camera" to begin
            </p>
          </div>
        </div>
      </div>
    );
  }

  const borderClass = sequenceStarted
    ? "border-4 border-green-500"
    : leftInHoldRange || rightInHoldRange
    ? "border-4 border-yellow-500"
    : "border-4 border-red-600";

  return (
    <div className="absolute inset-0 pointer-events-none">
      <div
        className={`absolute inset-0 rounded-lg pointer-events-none ${borderClass} transition-colors duration-200`}
      />
      {!sequenceStarted && stage !== "showCalibrated" && (
        <>
          <div className="absolute inset-0 bg-gray-800/50" />
          {/* center panel should receive pointer events so buttons are clickable */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
            <div className="relative z-10 max-w-md rounded-md bg-transparent px-6 py-4 text-center text-white pointer-events-auto">
              <div className="mb-2 font-semibold">Tambourine Calibration</div>

              {/* Step 1: choose holder */}
              {!selectedHolder && (
                <>
                  <div className="text-sm mb-3">
                    Step 1: Choose which hand will hold the tambourine:
                  </div>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => {
                        setSelectedHolder("left");
                        setSelectedStriker(null);
                      }}
                      className="rounded bg-blue-600 px-4 py-2 text-white"
                      type="button"
                    >
                      Left hand holds
                    </button>
                    <button
                      onClick={() => {
                        setSelectedHolder("right");
                        setSelectedStriker(null);
                      }}
                      className="rounded bg-blue-600 px-4 py-2 text-white"
                      type="button"
                    >
                      Right hand holds
                    </button>
                  </div>
                  <div className="text-sm mt-3">
                    Tip: After selecting the holder, select which other hand
                    stays open (striker).
                  </div>
                </>
              )}

              {/* Step 2: choose striker/open hand */}
              {selectedHolder && !selectedStriker && (
                <>
                  <div className="text-sm mb-3">
                    Step 2: Choose which hand remains open (striker). It cannot
                    be the same as the holder.
                  </div>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => setSelectedStriker("left")}
                      disabled={selectedHolder === "left"}
                      className={`rounded px-4 py-2 text-white ${
                        selectedHolder === "left"
                          ? "bg-gray-500 cursor-not-allowed"
                          : "bg-blue-600"
                      }`}
                      type="button"
                    >
                      Left hand open
                    </button>
                    <button
                      onClick={() => setSelectedStriker("right")}
                      disabled={selectedHolder === "right"}
                      className={`rounded px-4 py-2 text-white ${
                        selectedHolder === "right"
                          ? "bg-gray-500 cursor-not-allowed"
                          : "bg-blue-600"
                      }`}
                      type="button"
                    >
                      Right hand open
                    </button>
                  </div>
                </>
              )}

              {/* After roles assigned: place hands guidance */}
              {selectedHolder && selectedStriker && (
                <>
                  <div className="text-sm">
                    Holder: {selectedHolder} —{" "}
                    {guidanceFor(selectedHolder, holderPos)}
                  </div>
                  <div className="text-sm mt-1">
                    Striker (open hand): {selectedStriker} —{" "}
                    {strikerPos
                      ? strikerNotHolding
                        ? "Open"
                        : "Too close to hold"
                      : "Not detected"}
                  </div>
                  <div className="text-sm mt-3">
                    Keep the holder hand in the hold area and keep the striker
                    hand open (not in the holding position). Calibration will
                    begin automatically when both are in the correct positions.
                  </div>
                  <div className="mt-3 flex gap-2 justify-center">
                    <button
                      onClick={() => {
                        // allow user to change assignments if needed
                        setSelectedHolder(null);
                        setSelectedStriker(null);
                        setSequenceStarted(false);
                        setStage("idle");
                      }}
                      type="button"
                      className="rounded bg-gray-600 px-3 py-1 text-white"
                    >
                      Reset
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {stage === "showCalibrated" && (
          <div className="rounded bg-green-600/90 px-6 py-4 text-xl font-bold text-white">
            Calibrated!
          </div>
        )}
        {stage === "countdown" && countdown !== null && (
          <div className="flex flex-col items-center">
            <div className="rounded bg-black/80 px-6 py-3 text-lg font-semibold text-white">
              Get ready
            </div>
            <div className="mt-3 rounded-full bg-white/10 px-6 py-4 text-4xl font-bold text-white">
              {countdown}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
