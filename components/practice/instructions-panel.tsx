"use client";

import { useState } from "react";
import { Instrument, INSTRUMENT_INSTRUCTIONS } from "./instruments/instrument-types";
import { ChevronDown, ChevronUp, Info } from "lucide-react";

interface InstructionsPanelProps {
  instrument: Instrument;
}

export default function InstructionsPanel({ instrument }: InstructionsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const instructions = INSTRUMENT_INSTRUCTIONS[instrument];

  return (
    <div className="w-full max-w-2xl">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <span className="font-semibold text-blue-900 dark:text-blue-100">
            {instructions.title}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-2 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                Steps:
              </h3>
              <ol className="list-decimal list-inside space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300">
                {instructions.steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </div>

            {instructions.tips.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  Tips:
                </h3>
                <ul className="list-disc list-inside space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300">
                  {instructions.tips.map((tip, index) => (
                    <li key={index}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

