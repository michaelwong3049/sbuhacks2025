/**
 * Motion detection types
 */

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface HandLandmarks {
  landmarks: HandLandmark[];
  handIndex: number;
}

export interface MotionEvent {
  type: "hit" | "strum" | "tap";
  hitboxIndex: number;
  handIndex: number;
  timestamp: number;
}

