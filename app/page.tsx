"use client";

import { useEffect, useRef } from "react";
import * as Tone from "tone";

export default function Home() {
  const synthRef = useRef<Tone.PolySynth | null>(null);

  useEffect(() => {
    // Initialize Tone.js audio context
    const initAudio = async () => {
      await Tone.start();
      
      // Create a piano-like synth using Tone.js
      // No external samples needed - generates sound synthetically
      synthRef.current = new Tone.PolySynth(Tone.Synth, {
        oscillator: {
          type: "triangle"
        },
        envelope: {
          attack: 0.02,
          decay: 0.1,
          sustain: 0.3,
          release: 1.2
        }
      }).toDestination();
      
      console.log("Audio context started");
    };
    
    initAudio();
  }, []);

  const playCMajor = () => {
    if (!synthRef.current) return;

    // C Major chord: C, E, G
    const cMajor = ["C4", "E4", "G4"];
    
    // Play the chord
    synthRef.current.triggerAttackRelease(cMajor, "8n");
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <button
        onClick={playCMajor}
        className="px-8 py-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xl font-semibold"
      >
        Play C Major 🎹
      </button>
    </div>
  );
}
