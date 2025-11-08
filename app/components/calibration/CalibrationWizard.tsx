"use client";

import React, { useEffect, useRef, useState } from "react";

export default function CalibrationWizard({
  handPositions,
}: {
  handPositions: {
    left?: { x: number; y: number };
    right?: { x: number; y: number };
  };
}) {
  // Quadrant logic (normalized coords where (0,0) = top-left, (1,1) = bottom-right)
  // Drums requirement: left wrist in bottom-left (Q3): x < 0.5, y > 0.5
  //                    right wrist in bottom-right (Q4): x > 0.5, y > 0.5
  const left = handPositions.left;
  const right = handPositions.right;

  const leftInQ3 = !!left && left.x < 0.5 && left.y > 0.5;
  const rightInQ4 = !!right && right.x > 0.5 && right.y > 0.5;

  const guidanceFor = (
    hand: "left" | "right",
    point?: { x: number; y: number }
  ) => {
    if (!point)
      return `${hand === "left" ? "Left" : "Right"} hand not detected`;
    const msgs: string[] = [];
    // Horizontal guidance
    if (hand === "left") {
      if (point.x >= 0.5) msgs.push("Move left");
    } else {
      if (point.x <= 0.5) msgs.push("Move right");
    }
    // Vertical guidance
    if (point.y <= 0.5) msgs.push("Move lower");
    return msgs.length
      ? msgs.join(", ")
      : `${hand === "left" ? "Left" : "Right"} hand good`;
  };

  const isCalibrated = leftInQ3 && rightInQ4;

  // sequenceStarted: set when the user has held correct pose for 3s
  const [sequenceStarted, setSequenceStarted] = useState(false);
  // locked: set when countdown is finished -> overlay no longer shown
  const [locked, setLocked] = useState(false);
  // stage: 'idle' | 'showCalibrated' | 'countdown' | 'finished'
  const [stage, setStage] = useState<
    "idle" | "showCalibrated" | "countdown" | "finished"
  >("idle");
  const [countdown, setCountdown] = useState<number | null>(null);

  const holdTimerRef = useRef<number | null>(null);
  const showTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  // Start the 3s hold timer when both hands are in place. Cancel if they move.
  useEffect(() => {
    if (locked || sequenceStarted) return;

    if (leftInQ3 && rightInQ4) {
      if (!holdTimerRef.current) {
        holdTimerRef.current = window.setTimeout(() => {
          setSequenceStarted(true);
        }, 3000) as unknown as number;
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
  }, [leftInQ3, rightInQ4, sequenceStarted, locked]);

  // When sequence starts, show 'Calibrated!' for 2s, then start 5s countdown.
  useEffect(() => {
    if (!sequenceStarted) return;
    setStage("showCalibrated");

    showTimerRef.current = window.setTimeout(() => {
      setStage("countdown");
      setCountdown(5);
      // start interval
      countdownIntervalRef.current = window.setInterval(() => {
        setCountdown((c) => {
          if (c === null) return null;
          if (c <= 1) {
            // finish
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            setStage("finished");
            setLocked(true);
            return 0;
          }
          return c - 1;
        });
      }, 1000) as unknown as number;
    }, 2000) as unknown as number;

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
  }, [sequenceStarted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      if (countdownIntervalRef.current)
        clearInterval(countdownIntervalRef.current);
    };
  }, []);

  if (locked) return null;

  // border: green only after the 3s hold (sequenceStarted), yellow when one good, red when none
  const borderClass = sequenceStarted
    ? "border-4 border-green-500"
    : leftInQ3 || rightInQ4
    ? "border-4 border-yellow-500"
    : "border-4 border-red-600";

  return (
    <div className="absolute inset-0 pointer-events-none">
      <div
        className={`absolute inset-0 rounded-lg pointer-events-none ${borderClass} transition-colors duration-200`}
      />

      {/* Dim and guidance only when no sequence has started and not calibrated */}
      {!sequenceStarted && !isCalibrated && (
        <>
          <div className="absolute inset-0 bg-gray-800/50" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative z-10 max-w-md rounded-md bg-transparent px-6 py-4 text-center text-white pointer-events-none">
              <div className="mb-2 font-semibold">Calibration guidance</div>
              <div className="text-sm">Left: {guidanceFor("left", left)}</div>
              <div className="text-sm mt-1">
                Right: {guidanceFor("right", right)}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Center messages for calibrated display and countdown */}
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
