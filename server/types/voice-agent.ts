/**
 * TypeScript types for Voice Agent integration
 */

export type LessonPhase = "intro" | "demonstration" | "practice" | "feedback" | "completed";

export interface PerformanceMetrics {
  notesPlayed: number;
  correctNotes: number;
  missedNotes: number;
  accuracy: number; // percentage 0-100
  avgVelocity: number;
  avgTiming: number; // milliseconds deviation from target
  recentAttempts: AttemptData[];
}

export interface AttemptData {
  timestamp: number;
  notePressed: string;
  targetNote: string;
  correct: boolean;
  velocity: number;
  timingDeviation: number; // ms from expected time
}

export interface LessonExercise {
  name: string;
  targetNotes: string[];
  tempo?: number; // BPM
  description?: string;
}

export interface LessonState {
  phase: LessonPhase;
  currentExercise?: LessonExercise;
  metrics: PerformanceMetrics;
  startTime?: number;
}

// WebSocket message types
export type ClientMessageType =
  | "start_session"
  | "end_session"
  | "performance_update"
  | "user_message"
  | "tool_response";

export type ServerMessageType =
  | "session_started"
  | "session_ended"
  | "agent_speaking"
  | "agent_listening"
  | "tool_call"
  | "error";

export interface ClientMessage {
  type: ClientMessageType;
  data: any;
  timestamp: number;
}

export interface ServerMessage {
  type: ServerMessageType;
  data: any;
  timestamp: number;
}

// Tool call messages from ElevenLabs
export interface ToolCall {
  tool_name: string;
  parameters: any;
}

export interface ToolResponse {
  tool_call_id: string;
  result: any;
}
