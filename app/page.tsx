"use client";

import { useEffect, useRef, useState } from "react";
import { MiniKeys, noteToMidi } from "minikeys";

export default function Home() {
  const keysRef = useRef<MiniKeys | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Initialize minikeys
    keysRef.current = new MiniKeys();

    // Load samples for C Major chord (C4, E4, G4)
    // Using a simple approach - you'll need to provide sample URLs
    // For now, using a CDN or local samples
    const samples = [
      {
        note: "C4" as const,
        url: "https://raw.githubusercontent.com/liampuk/minikeys/main/samples/p60.mp3", // C4 = MIDI 60
        velocity: "piano" as const,
      },
      {
        note: "E4" as const,
        url: "https://raw.githubusercontent.com/liampuk/minikeys/main/samples/p64.mp3", // E4 = MIDI 64
        velocity: "piano" as const,
      },
      {
        note: "G4" as const,
        url: "https://raw.githubusercontent.com/liampuk/minikeys/main/samples/p67.mp3", // G4 = MIDI 67
        velocity: "piano" as const,
      },
    ];

    if (keysRef.current) {
      keysRef.current
        .loadNotes(samples, (progress) => {
          if (progress === 1) {
            setIsLoaded(true);
          }
        })
        .catch((err) => {
          console.error("Error loading samples:", err);
        });
    }
  }, []);

  const playCMajor = () => {
    if (!keysRef.current || !isLoaded) return;

    // C Major chord: C4, E4, G4
    keysRef.current.playNoteFromName("C4");
    keysRef.current.playNoteFromName("E4");
    keysRef.current.playNoteFromName("G4");
  };

  return (
    <div className="flex min-h-screen items-center justify-center flex-col gap-4">
      <button
        onClick={playCMajor}
        disabled={!isLoaded}
        className="px-8 py-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoaded ? "Play C Major 🎹" : "Loading samples..."}
      </button>
      {!isLoaded && <p className="text-gray-500">Loading piano samples...</p>}
    </div>
  );
}
