"use client";

import { useEffect, useState } from "react";
import { Instrument } from "./instruments/instrument-types";
import InstrumentSelector from "./instrument-selector";
import InstructionsPanel from "./instructions-panel";
import AirDrumsPlayer from "./instruments/air-drums-player";
import PianoPlayer from "./instruments/piano-player";
import TambourinePlayer from "./instruments/tambourine-player";
import TrianglePlayer from "./instruments/triangle-player";

export default function PracticeClient() {
  const [selectedInstrument, setSelectedInstrument] = useState<Instrument>('drums');
  const [mounted, setMounted] = useState(false);

  // Load saved instrument preference on mount
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('selectedInstrument');
    if (saved && ['drums', 'piano', 'tambourine', 'triangle'].includes(saved)) {
      setSelectedInstrument(saved as Instrument);
    }
  }, []);

  // Save instrument preference whenever it changes
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('selectedInstrument', selectedInstrument);
    }
  }, [selectedInstrument, mounted]);

  const handleInstrumentChange = (instrument: Instrument) => {
    setSelectedInstrument(instrument);
  };

  return (
    <div className="w-full flex flex-col items-center gap-6">
      <InstrumentSelector
        selectedInstrument={selectedInstrument}
        onInstrumentChange={handleInstrumentChange}
      />

      <InstructionsPanel instrument={selectedInstrument} />

      {selectedInstrument === 'drums' && <AirDrumsPlayer />}
      {selectedInstrument === 'piano' && <PianoPlayer />}
      {selectedInstrument === 'tambourine' && <TambourinePlayer />}
      {selectedInstrument === 'triangle' && <TrianglePlayer />}
    </div>
  );
}

