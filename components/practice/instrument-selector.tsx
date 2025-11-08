"use client";

import { Instrument, INSTRUMENT_LABELS } from "./instruments/instrument-types";

interface InstrumentSelectorProps {
  selectedInstrument: Instrument;
  onInstrumentChange: (instrument: Instrument) => void;
}

export default function InstrumentSelector({
  selectedInstrument,
  onInstrumentChange,
}: InstrumentSelectorProps) {
  const instruments: Instrument[] = ['drums', 'piano', 'tambourine', 'triangle'];

  return (
    <div className="w-full max-w-2xl">
      <div className="flex items-center justify-center gap-2 p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
        {instruments.map((instrument) => (
          <button
            key={instrument}
            onClick={() => onInstrumentChange(instrument)}
            className={`
              flex-1 px-4 py-2.5 rounded-md font-medium transition-all
              ${
                selectedInstrument === instrument
                  ? 'bg-white dark:bg-zinc-700 text-black dark:text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white'
              }
            `}
          >
            {INSTRUMENT_LABELS[instrument]}
          </button>
        ))}
      </div>
    </div>
  );
}

