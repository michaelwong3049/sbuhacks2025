export type Instrument = 'drums' | 'piano' | 'tambourine' | 'triangle';

export interface HandPositions {
  left?: { x: number; y: number };
  right?: { x: number; y: number };
}

export interface InstrumentPlayerProps {
  isActive: boolean;
  onStart: () => void;
  onStop: () => void;
}

export const INSTRUMENT_LABELS: Record<Instrument, string> = {
  drums: '🥁 Drums',
  piano: '🎹 Piano',
  tambourine: '🪘 Tambourine',
  triangle: '🔺 Triangle',
};

export const INSTRUMENT_INSTRUCTIONS: Record<Instrument, {
  title: string;
  steps: string[];
  tips: string[];
}> = {
  drums: {
    title: 'How to Play Air Drums',
    steps: [
      'Position your hands in the bottom corners of the screen',
      'Hold the calibration pose for 3 seconds',
      'Strike downward quickly to hit the left or right snare drums',
      'Strike down at center-bottom for the bass kick',
      'Flick upward at center-top for the hi-hat',
    ],
    tips: [
      'Use quick, deliberate motions for better detection',
      'Adjust velocity threshold if drums are too sensitive or not sensitive enough',
      'Move horizontally while striking down for side snares',
      'Watch the hand speed indicators to see your gesture speed',
    ],
  },
  piano: {
    title: 'How to Play Air Piano',
    steps: [
      'Instructions coming soon - instrument in development',
    ],
    tips: [
      'This instrument is currently being developed',
    ],
  },
  tambourine: {
    title: 'How to Play Air Tambourine',
    steps: [
      'Instructions coming soon - instrument in development',
    ],
    tips: [
      'This instrument is currently being developed',
    ],
  },
  triangle: {
    title: 'How to Play Air Triangle',
    steps: [
      'Instructions coming soon - instrument in development',
    ],
    tips: [
      'This instrument is currently being developed',
    ],
  },
};

